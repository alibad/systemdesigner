import asyncio
from enum import Enum
from typing import Dict, List, Any, Callable
from datetime import datetime, timedelta

class WorkflowState(Enum):
    STARTED = "started"
    AI_PROCESSING = "ai_processing"
    ROUTING_DECISION = "routing_decision"
    HUMAN_REVIEW = "human_review"
    EXPERT_REVIEW = "expert_review"
    COMPLETED = "completed"
    FAILED = "failed"

class HITLWorkflowOrchestrator:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.workflows = {}
        self.state_handlers = self._initialize_state_handlers()
        self.workflow_templates = self._load_workflow_templates()

    def _initialize_state_handlers(self) -> Dict[WorkflowState, Callable]:
        """Initialize handlers for each workflow state"""
        return {
            WorkflowState.STARTED: self._handle_workflow_start,
            WorkflowState.AI_PROCESSING: self._handle_ai_processing,
            WorkflowState.ROUTING_DECISION: self._handle_routing_decision,
            WorkflowState.HUMAN_REVIEW: self._handle_human_review,
            WorkflowState.EXPERT_REVIEW: self._handle_expert_review,
            WorkflowState.COMPLETED: self._handle_workflow_completion,
            WorkflowState.FAILED: self._handle_workflow_failure
        }

    async def start_workflow(self,
                           workflow_type: str,
                           request_data: Dict[str, Any],
                           workflow_id: str = None) -> str:
        """Start a new HITL workflow"""

        if workflow_id is None:
            workflow_id = self._generate_workflow_id()

        # Get workflow template
        template = self.workflow_templates.get(workflow_type)
        if not template:
            raise ValueError(f"Unknown workflow type: {workflow_type}")

        # Initialize workflow state
        workflow = {
            'id': workflow_id,
            'type': workflow_type,
            'state': WorkflowState.STARTED,
            'request_data': request_data,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'template': template,
            'context': {},
            'results': {},
            'transitions': []
        }

        self.workflows[workflow_id] = workflow

        # Start workflow execution
        await self._execute_workflow_step(workflow_id)

        return workflow_id

    async def _execute_workflow_step(self, workflow_id: str):
        """Execute the next step in the workflow"""

        workflow = self.workflows.get(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        current_state = workflow['state']

        # Get handler for current state
        handler = self.state_handlers.get(current_state)
        if not handler:
            raise ValueError(f"No handler for state {current_state}")

        try:
            # Execute state handler
            result = await handler(workflow)

            # Update workflow with results
            workflow['results'][current_state.value] = result
            workflow['updated_at'] = datetime.now()

            # Determine next state
            next_state = self._determine_next_state(workflow, result)

            if next_state and next_state != current_state:
                # Record state transition
                transition = {
                    'from_state': current_state.value,
                    'to_state': next_state.value,
                    'timestamp': datetime.now(),
                    'trigger': result.get('transition_trigger', 'automatic')
                }
                workflow['transitions'].append(transition)

                # Update workflow state
                workflow['state'] = next_state

                # Continue workflow if not terminal state
                if next_state not in [WorkflowState.COMPLETED, WorkflowState.FAILED]:
                    await self._execute_workflow_step(workflow_id)

        except Exception as e:
            # Handle workflow failure
            workflow['state'] = WorkflowState.FAILED
            workflow['error'] = str(e)
            await self._handle_workflow_failure(workflow)

    async def _handle_workflow_start(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """Handle workflow start state"""
        return {
            'status': 'initialized',
            'transition_trigger': 'start_ai_processing'
        }

    async def _handle_ai_processing(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """Handle AI processing state"""

        # Extract features and run AI model
        request_data = workflow['request_data']

        # Simulate AI processing (replace with actual ML inference)
        ai_prediction = await self._run_ai_inference(request_data)

        # Store AI results in workflow context
        workflow['context']['ai_result'] = ai_prediction

        return {
            'status': 'ai_completed',
            'prediction': ai_prediction['prediction'],
            'confidence': ai_prediction['confidence'],
            'transition_trigger': 'routing_required'
        }

    async def _handle_routing_decision(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """Handle routing decision state"""

        ai_result = workflow['context']['ai_result']
        request_data = workflow['request_data']

        # Apply routing rules
        routing_decision = await self._make_routing_decision(ai_result, request_data)

        workflow['context']['routing_decision'] = routing_decision

        return {
            'status': 'routing_completed',
            'routing_action': routing_decision['action'],
            'transition_trigger': routing_decision['action']
        }

    async def _handle_human_review(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """Handle human review state"""

        # Queue for human review
        review_queue_item = {
            'workflow_id': workflow['id'],
            'ai_result': workflow['context']['ai_result'],
            'request_data': workflow['request_data'],
            'priority': workflow['context']['routing_decision'].get('priority', 'normal')
        }

        await self._queue_for_human_review(review_queue_item)

        # Wait for human decision (this would be handled by a separate process)
        # For now, return pending status
        return {
            'status': 'queued_for_human_review',
            'queue_position': await self._get_queue_position(),
            'estimated_time': await self._estimate_review_time(),
            'transition_trigger': 'await_human_decision'
        }

    async def process_human_decision(self,
                                   workflow_id: str,
                                   human_decision: Dict[str, Any]) -> Dict[str, Any]:
        """Process human decision and continue workflow"""

        workflow = self.workflows.get(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        # Store human decision in context
        workflow['context']['human_decision'] = human_decision

        # Continue workflow based on human decision
        if human_decision['decision'] == 'escalate':
            workflow['state'] = WorkflowState.EXPERT_REVIEW
        else:
            workflow['state'] = WorkflowState.COMPLETED

        await self._execute_workflow_step(workflow_id)

        return {
            'workflow_id': workflow_id,
            'status': workflow['state'].value,
            'decision_processed': True
        }

    def _determine_next_state(self,
                            workflow: Dict[str, Any],
                            current_result: Dict[str, Any]) -> WorkflowState:
        """Determine next workflow state based on current result"""

        current_state = workflow['state']
        trigger = current_result.get('transition_trigger')

        # State transition logic
        transitions = {
            WorkflowState.STARTED: {
                'start_ai_processing': WorkflowState.AI_PROCESSING
            },
            WorkflowState.AI_PROCESSING: {
                'routing_required': WorkflowState.ROUTING_DECISION
            },
            WorkflowState.ROUTING_DECISION: {
                'auto_approve': WorkflowState.COMPLETED,
                'human_review': WorkflowState.HUMAN_REVIEW,
                'expert_escalation': WorkflowState.EXPERT_REVIEW
            },
            WorkflowState.HUMAN_REVIEW: {
                'human_approved': WorkflowState.COMPLETED,
                'human_rejected': WorkflowState.COMPLETED,
                'escalate_to_expert': WorkflowState.EXPERT_REVIEW
            },
            WorkflowState.EXPERT_REVIEW: {
                'expert_decision': WorkflowState.COMPLETED
            }
        }

        return transitions.get(current_state, {}).get(trigger)

    async def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """Get current workflow status"""

        workflow = self.workflows.get(workflow_id)
        if not workflow:
            return {'error': 'Workflow not found'}

        return {
            'workflow_id': workflow_id,
            'type': workflow['type'],
            'current_state': workflow['state'].value,
            'created_at': workflow['created_at'].isoformat(),
            'updated_at': workflow['updated_at'].isoformat(),
            'progress': self._calculate_workflow_progress(workflow),
            'estimated_completion': self._estimate_completion_time(workflow),
            'context': workflow['context'],
            'transitions': workflow['transitions']
        }

    def _calculate_workflow_progress(self, workflow: Dict[str, Any]) -> float:
        """Calculate workflow completion progress (0-1)"""

        total_states = len(WorkflowState) - 2  # Exclude COMPLETED and FAILED
        completed_transitions = len(workflow['transitions'])

        return min(completed_transitions / total_states, 1.0)

    async def get_workflow_analytics(self) -> Dict[str, Any]:
        """Get analytics across all workflows"""

        if not self.workflows:
            return {}

        # Aggregate statistics
        workflows_by_type = {}
        workflows_by_state = {}
        avg_processing_times = {}

        for workflow in self.workflows.values():
            # Count by type
            workflow_type = workflow['type']
            workflows_by_type[workflow_type] = workflows_by_type.get(workflow_type, 0) + 1

            # Count by state
            state = workflow['state'].value
            workflows_by_state[state] = workflows_by_state.get(state, 0) + 1

            # Calculate processing time for completed workflows
            if workflow['state'] == WorkflowState.COMPLETED:
                processing_time = (workflow['updated_at'] - workflow['created_at']).total_seconds()
                if workflow_type not in avg_processing_times:
                    avg_processing_times[workflow_type] = []
                avg_processing_times[workflow_type].append(processing_time)

        # Calculate averages
        for workflow_type in avg_processing_times:
            times = avg_processing_times[workflow_type]
            avg_processing_times[workflow_type] = sum(times) / len(times)

        return {
            'total_workflows': len(self.workflows),
            'workflows_by_type': workflows_by_type,
            'workflows_by_state': workflows_by_state,
            'avg_processing_times': avg_processing_times,
            'automation_rate': self._calculate_automation_rate(),
            'human_review_rate': self._calculate_human_review_rate()
        }

    def _calculate_automation_rate(self) -> float:
        """Calculate percentage of fully automated decisions"""
        completed_workflows = [w for w in self.workflows.values()
                             if w['state'] == WorkflowState.COMPLETED]

        if not completed_workflows:
            return 0.0

        automated_count = 0
        for workflow in completed_workflows:
            # Check if workflow went through human review
            states_visited = [t['to_state'] for t in workflow['transitions']]
            if 'human_review' not in states_visited and 'expert_review' not in states_visited:
                automated_count += 1

        return automated_count / len(completed_workflows)
