"""
Agent Goal Completion Evaluation Framework
Track and evaluate whether agents successfully complete their objectives
"""

from dataclasses import dataclass
from typing import Literal, Optional
from datetime import datetime

@dataclass
class Goal:
    """Represents an agent's objective"""
    id: str
    description: str
    success_criteria: list[str]  # Conditions that must be met
    max_steps: int = 50
    timeout_seconds: int = 300

@dataclass
class AgentStep:
    """A single step in the agent's trajectory"""
    step_number: int
    action_type: Literal["tool_call", "reasoning", "response", "error"]
    action_content: str
    tool_name: Optional[str] = None
    tool_result: Optional[str] = None
    timestamp: datetime = None

@dataclass
class GoalResult:
    """Result of goal completion evaluation"""
    goal_id: str
    completed: bool
    partial_completion: float  # 0.0 to 1.0
    steps_taken: int
    time_elapsed_seconds: float
    failure_reason: Optional[str] = None
    criteria_met: dict[str, bool] = None

class GoalCompletionEvaluator:
    """Evaluate agent goal completion"""

    def __init__(self, goal: Goal):
        self.goal = goal
        self.steps: list[AgentStep] = []
        self.start_time = datetime.now()

    def record_step(self, step: AgentStep):
        """Record an agent step"""
        step.timestamp = datetime.now()
        step.step_number = len(self.steps) + 1
        self.steps.append(step)

    def check_criteria(self, final_state: dict) -> dict[str, bool]:
        """Check which success criteria are met"""
        criteria_results = {}
        for criterion in self.goal.success_criteria:
            # Simple keyword matching - customize for your use case
            criterion_met = self._evaluate_criterion(criterion, final_state)
            criteria_results[criterion] = criterion_met
        return criteria_results

    def _evaluate_criterion(self, criterion: str, state: dict) -> bool:
        """Evaluate a single criterion against final state"""
        # Example criteria evaluations:
        if "file_created" in criterion:
            return state.get("files_created", 0) > 0
        if "api_called" in criterion:
            return state.get("api_calls_made", 0) > 0
        if "error_free" in criterion:
            return state.get("errors", 0) == 0
        # Default: check if criterion keywords appear in state
        return any(word in str(state) for word in criterion.split())

    def evaluate(self, final_state: dict) -> GoalResult:
        """Generate final evaluation"""
        elapsed = (datetime.now() - self.start_time).total_seconds()
        criteria_met = self.check_criteria(final_state)

        # Calculate partial completion
        met_count = sum(criteria_met.values())
        total_criteria = len(criteria_met)
        partial = met_count / total_criteria if total_criteria > 0 else 0.0

        # Determine completion status
        completed = all(criteria_met.values())

        # Check for failure reasons
        failure_reason = None
        if not completed:
            if len(self.steps) >= self.goal.max_steps:
                failure_reason = "Max steps exceeded"
            elif elapsed >= self.goal.timeout_seconds:
                failure_reason = "Timeout"
            elif partial < 1.0:
                unmet = [c for c, met in criteria_met.items() if not met]
                failure_reason = f"Unmet criteria: {', '.join(unmet)}"

        return GoalResult(
            goal_id=self.goal.id,
            completed=completed,
            partial_completion=partial,
            steps_taken=len(self.steps),
            time_elapsed_seconds=elapsed,
            failure_reason=failure_reason,
            criteria_met=criteria_met
        )

def run_agent_evaluation(agent_fn, goal: Goal, initial_context: dict) -> GoalResult:
    """Run an agent and evaluate goal completion"""
    evaluator = GoalCompletionEvaluator(goal)

    # Simulate agent execution
    context = initial_context.copy()
    for step_num in range(goal.max_steps):
        # Get agent's next action
        action = agent_fn(context, goal.description)

        # Record the step
        evaluator.record_step(AgentStep(
            step_number=step_num,
            action_type=action["type"],
            action_content=action["content"],
            tool_name=action.get("tool"),
            tool_result=action.get("result")
        ))

        # Update context with action result
        context.update(action.get("state_updates", {}))

        # Check if agent signals completion
        if action.get("done", False):
            break

    return evaluator.evaluate(context)

# Example usage
if __name__ == "__main__":
    # Define a goal
    goal = Goal(
        id="book_flight",
        description="Book a flight from NYC to LAX for next Friday",
        success_criteria=[
            "search_api_called",
            "flight_selected",
            "booking_confirmed",
            "error_free"
        ],
        max_steps=20
    )

    # Mock agent function
    def mock_agent(context, goal_desc):
        return {
            "type": "tool_call",
            "content": "Searching for flights...",
            "tool": "flight_search",
            "result": "Found 5 flights",
            "state_updates": {"api_calls_made": 1},
            "done": True
        }

    result = run_agent_evaluation(mock_agent, goal, {})
    print(f"Completed: {result.completed}")
    print(f"Partial: {result.partial_completion:.1%}")
    print(f"Steps: {result.steps_taken}")
