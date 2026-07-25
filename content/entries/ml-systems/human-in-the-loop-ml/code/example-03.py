import asyncio
import torch
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from enum import Enum
import redis
import json
import uuid
import logging

class DecisionStatus(Enum):
    PENDING_AI = "pending_ai"
    PENDING_HUMAN = "pending_human"
    PENDING_EXPERT = "pending_expert"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"

class ConfidenceLevel(Enum):
    HIGH = "high"      # > 0.9
    MEDIUM = "medium"  # 0.7 - 0.9
    LOW = "low"        # < 0.7

class HITLMLService:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Initialize ML models
        self.ml_model = self._load_ml_model(config['model_path'])
        self.confidence_estimator = self._load_confidence_model()
        self.active_learner = ActiveLearningSystem(self.ml_model)

        # Human workflow components
        self.decision_router = DecisionRouter(config['routing_rules'])
        self.review_interface = ReviewInterface(config['ui_config'])
        self.feedback_collector = HumanFeedbackLoop(self.ml_model)

        # Storage and queuing
        self.redis_client = redis.Redis(
            host=config.get('redis_host', 'localhost'),
            port=config.get('redis_port', 6379),
            decode_responses=True
        )

        # Performance tracking
        self.metrics = {
            'total_decisions': 0,
            'automated_decisions': 0,
            'human_reviews': 0,
            'expert_escalations': 0,
            'avg_processing_time': 0,
            'accuracy_score': 0
        }

    def _load_ml_model(self, model_path: str):
        """Load the main ML model"""
        # Implementation depends on model type
        model = torch.load(model_path, map_location=self.device)
        model.eval()
        return model

    def _load_confidence_model(self):
        """Load model for confidence estimation"""
        # This could be a separate model trained to estimate prediction confidence
        return None  # Placeholder

    async def process_request(self,
                            request_data: Dict[str, Any],
                            request_id: str = None) -> Dict[str, Any]:
        """Main entry point for processing requests"""

        if request_id is None:
            request_id = str(uuid.uuid4())

        start_time = datetime.now()
        self.metrics['total_decisions'] += 1

        try:
            # Step 1: AI Processing
            ai_result = await self._process_with_ai(request_data, request_id)

            # Step 2: Decision Routing
            routing_decision = await self._route_decision(ai_result, request_data)

            # Step 3: Handle based on routing decision
            if routing_decision['action'] == 'auto_approve':
                final_result = await self._auto_approve(ai_result, request_id)
                self.metrics['automated_decisions'] += 1

            elif routing_decision['action'] == 'human_review':
                final_result = await self._queue_for_human_review(
                    ai_result, request_data, request_id, routing_decision
                )
                self.metrics['human_reviews'] += 1

            elif routing_decision['action'] == 'expert_escalation':
                final_result = await self._escalate_to_expert(
                    ai_result, request_data, request_id, routing_decision
                )
                self.metrics['expert_escalations'] += 1

            else:
                raise ValueError(f"Unknown routing action: {routing_decision['action']}")

            # Update metrics
            processing_time = (datetime.now() - start_time).total_seconds()
            self._update_performance_metrics(processing_time)

            return final_result

        except Exception as e:
            logging.error(f"Error processing request {request_id}: {e}")
            return {
                'request_id': request_id,
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    async def _process_with_ai(self,
                             request_data: Dict[str, Any],
                             request_id: str) -> Dict[str, Any]:
        """Process request with AI model"""

        # Extract features from request
        features = self._extract_features(request_data)

        # Get AI prediction
        with torch.no_grad():
            prediction = self.ml_model(features)
            prediction_probs = torch.softmax(prediction, dim=-1)

        # Calculate confidence and uncertainty
        confidence = torch.max(prediction_probs).item()
        uncertainty = self._calculate_uncertainty(prediction_probs)

        # Determine confidence level
        if confidence > 0.9:
            confidence_level = ConfidenceLevel.HIGH
        elif confidence > 0.7:
            confidence_level = ConfidenceLevel.MEDIUM
        else:
            confidence_level = ConfidenceLevel.LOW

        ai_result = {
            'request_id': request_id,
            'prediction': torch.argmax(prediction).item(),
            'prediction_probs': prediction_probs.tolist(),
            'confidence': confidence,
            'uncertainty': uncertainty,
            'confidence_level': confidence_level.value,
            'features': features.tolist(),
            'processing_time': datetime.now().isoformat()
        }

        # Store AI result for potential human review
        await self._store_ai_result(request_id, ai_result)

        return ai_result

    async def _route_decision(self,
                            ai_result: Dict[str, Any],
                            request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Route decision based on confidence and business rules"""

        confidence = ai_result['confidence']
        uncertainty = ai_result['uncertainty']

        # Business rule checks
        is_high_risk = self._check_high_risk_conditions(request_data)
        requires_compliance = self._check_compliance_requirements(request_data)

        # Routing logic
        if confidence > 0.95 and not is_high_risk and not requires_compliance:
            action = 'auto_approve'
            reason = 'High confidence, low risk'

        elif confidence > 0.8 and not is_high_risk:
            action = 'human_review'
            reason = 'Medium confidence, requires human validation'
            queue_priority = 'normal'

        elif confidence > 0.5:
            action = 'human_review'
            reason = 'Low confidence, requires careful review'
            queue_priority = 'high'

        else:
            action = 'expert_escalation'
            reason = 'Very low confidence or high-risk case'
            queue_priority = 'urgent'

        routing_decision = {
            'action': action,
            'reason': reason,
            'confidence': confidence,
            'uncertainty': uncertainty,
            'is_high_risk': is_high_risk,
            'requires_compliance': requires_compliance
        }

        if action in ['human_review', 'expert_escalation']:
            routing_decision['queue_priority'] = queue_priority

        return routing_decision

    async def _queue_for_human_review(self,
                                    ai_result: Dict[str, Any],
                                    request_data: Dict[str, Any],
                                    request_id: str,
                                    routing_decision: Dict[str, Any]) -> Dict[str, Any]:
        """Queue request for human review"""

        review_item = {
            'request_id': request_id,
            'ai_result': ai_result,
            'original_request': request_data,
            'routing_decision': routing_decision,
            'status': DecisionStatus.PENDING_HUMAN.value,
            'created_at': datetime.now().isoformat(),
            'priority': routing_decision.get('queue_priority', 'normal')
        }

        # Add to review queue
        queue_name = f"human_review:{routing_decision.get('queue_priority', 'normal')}"
        await asyncio.get_event_loop().run_in_executor(
            None, self.redis_client.lpush, queue_name, json.dumps(review_item)
        )

        # Set timeout for review
        timeout_hours = self.config.get('review_timeout_hours', 24)
        await asyncio.get_event_loop().run_in_executor(
            None, self.redis_client.expire, f"pending:{request_id}", timeout_hours * 3600
        )

        return {
            'request_id': request_id,
            'status': DecisionStatus.PENDING_HUMAN.value,
            'queue_position': await self._get_queue_position(queue_name),
            'estimated_review_time': self._estimate_review_time(routing_decision['queue_priority']),
            'ai_recommendation': {
                'prediction': ai_result['prediction'],
                'confidence': ai_result['confidence']
            }
        }

    async def submit_human_decision(self,
                                  request_id: str,
                                  human_decision: Dict[str, Any],
                                  reviewer_id: str) -> Dict[str, Any]:
        """Process human review decision"""

        try:
            # Retrieve original AI result
            ai_result = await self._get_ai_result(request_id)
            if not ai_result:
                raise ValueError(f"No AI result found for request {request_id}")

            # Validate human decision
            decision = human_decision['decision']  # 'approve', 'reject', 'escalate'
            confidence = human_decision.get('confidence', 1.0)
            feedback = human_decision.get('feedback', '')

            # Process decision
            if decision == 'approve':
                final_status = DecisionStatus.APPROVED
            elif decision == 'reject':
                final_status = DecisionStatus.REJECTED
            elif decision == 'escalate':
                return await self._escalate_to_expert(
                    ai_result, {}, request_id, {'reason': 'Human escalation'}
                )
            else:
                raise ValueError(f"Invalid decision: {decision}")

            # Store decision
            decision_record = {
                'request_id': request_id,
                'final_decision': decision,
                'status': final_status.value,
                'ai_prediction': ai_result['prediction'],
                'ai_confidence': ai_result['confidence'],
                'human_decision': decision,
                'human_confidence': confidence,
                'reviewer_id': reviewer_id,
                'feedback': feedback,
                'completed_at': datetime.now().isoformat()
            }

            await self._store_decision_record(request_id, decision_record)

            # Collect feedback for model improvement
            feedback_type = 'positive' if ai_result['prediction'] == (1 if decision == 'approve' else 0) else 'correction'
            self.feedback_collector.collect_feedback(
                request_id,
                1 if decision == 'approve' else 0,
                feedback_type,
                confidence
            )

            # Remove from pending queue
            await self._remove_from_pending(request_id)

            return {
                'request_id': request_id,
                'status': final_status.value,
                'final_decision': decision,
                'agreement_with_ai': ai_result['prediction'] == (1 if decision == 'approve' else 0),
                'processing_complete': True
            }

        except Exception as e:
            logging.error(f"Error processing human decision for {request_id}: {e}")
            return {
                'request_id': request_id,
                'status': 'error',
                'error': str(e)
            }

    async def get_review_queue(self,
                             reviewer_id: str,
                             queue_type: str = 'normal',
                             limit: int = 10) -> List[Dict[str, Any]]:
        """Get pending items for human review"""

        queue_name = f"human_review:{queue_type}"

        # Get items from queue
        queue_items = await asyncio.get_event_loop().run_in_executor(
            None, self.redis_client.lrange, queue_name, 0, limit - 1
        )

        review_items = []
        for item_json in queue_items:
            item = json.loads(item_json)

            # Enrich with additional context for reviewer
            enriched_item = {
                'request_id': item['request_id'],
                'ai_recommendation': {
                    'prediction': item['ai_result']['prediction'],
                    'confidence': item['ai_result']['confidence'],
                    'confidence_level': item['ai_result']['confidence_level']
                },
                'request_summary': self._create_request_summary(item['original_request']),
                'priority': item['priority'],
                'created_at': item['created_at'],
                'time_in_queue': self._calculate_time_in_queue(item['created_at']),
                'routing_reason': item['routing_decision']['reason']
            }

            review_items.append(enriched_item)

        return review_items

    def _extract_features(self, request_data: Dict[str, Any]) -> torch.Tensor:
        """Extract features from request data"""
        # Implementation depends on the specific use case
        # This is a placeholder
        features = torch.tensor([1.0, 2.0, 3.0], device=self.device)
        return features

    def _calculate_uncertainty(self, prediction_probs: torch.Tensor) -> float:
        """Calculate prediction uncertainty"""
        # Use entropy as uncertainty measure
        entropy = -torch.sum(prediction_probs * torch.log(prediction_probs + 1e-8))
        return entropy.item()

    def _check_high_risk_conditions(self, request_data: Dict[str, Any]) -> bool:
        """Check if request meets high-risk conditions"""
        # Business-specific high-risk checks
        return request_data.get('amount', 0) > 10000  # Example

    def _check_compliance_requirements(self, request_data: Dict[str, Any]) -> bool:
        """Check if request requires compliance review"""
        # Compliance-specific checks
        return request_data.get('requires_audit', False)  # Example

    async def _store_ai_result(self, request_id: str, ai_result: Dict[str, Any]):
        """Store AI result in Redis"""
        key = f"ai_result:{request_id}"
        await asyncio.get_event_loop().run_in_executor(
            None, self.redis_client.setex, key, 86400, json.dumps(ai_result)  # 24 hour expiry
        )

    async def _get_ai_result(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve AI result from Redis"""
        key = f"ai_result:{request_id}"
        result_json = await asyncio.get_event_loop().run_in_executor(
            None, self.redis_client.get, key
        )
        return json.loads(result_json) if result_json else None

    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get comprehensive system metrics"""

        # Get queue sizes
        queue_sizes = {}
        for priority in ['urgent', 'high', 'normal', 'low']:
            queue_name = f"human_review:{priority}"
            size = await asyncio.get_event_loop().run_in_executor(
                None, self.redis_client.llen, queue_name
            )
            queue_sizes[priority] = size

        # Calculate automation rate
        total_decisions = self.metrics['total_decisions']
        automation_rate = (
            self.metrics['automated_decisions'] / total_decisions
            if total_decisions > 0 else 0
        )

        # Get feedback analytics
        feedback_analytics = self.feedback_collector.get_feedback_analytics()

        return {
            'processing_metrics': {
                'total_decisions': total_decisions,
                'automated_decisions': self.metrics['automated_decisions'],
                'human_reviews': self.metrics['human_reviews'],
                'expert_escalations': self.metrics['expert_escalations'],
                'automation_rate': automation_rate,
                'avg_processing_time_ms': self.metrics['avg_processing_time'] * 1000
            },
            'queue_status': {
                'total_pending': sum(queue_sizes.values()),
                'by_priority': queue_sizes
            },
            'model_performance': {
                'accuracy_score': self.metrics['accuracy_score'],
                'feedback_analytics': feedback_analytics
            },
            'system_health': {
                'active_reviewers': await self._count_active_reviewers(),
                'avg_review_time': await self._calculate_avg_review_time(),
                'sla_compliance': await self._calculate_sla_compliance()
            }
        }

    def _update_performance_metrics(self, processing_time: float):
        """Update system performance metrics"""
        # Update average processing time using exponential moving average
        alpha = 0.1
        self.metrics['avg_processing_time'] = (
            alpha * processing_time +
            (1 - alpha) * self.metrics['avg_processing_time']
        )
