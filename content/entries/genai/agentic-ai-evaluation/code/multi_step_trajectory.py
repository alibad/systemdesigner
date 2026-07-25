"""
Multi-Step Trajectory Analysis
Analyze and evaluate the full trajectory of agent actions
"""

from dataclasses import dataclass, field
from typing import Literal, Optional
from datetime import datetime
import json

@dataclass
class TrajectoryStep:
    """A single step in agent trajectory"""
    step_id: int
    action: str
    observation: str
    reasoning: Optional[str] = None
    tool_calls: list[dict] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class TrajectoryAnalysis:
    """Analysis results for a trajectory"""
    total_steps: int
    backtrack_count: int  # Times agent revised its approach
    tool_call_count: int
    reasoning_quality: float  # 0-1 score
    plan_coherence: float  # 0-1 score
    efficiency_score: float  # Steps vs optimal
    anomalies: list[str]

class TrajectoryAnalyzer:
    """Analyze agent trajectories for quality and patterns"""

    def __init__(self):
        self.steps: list[TrajectoryStep] = []

    def add_step(self, step: TrajectoryStep):
        """Add a step to the trajectory"""
        step.step_id = len(self.steps)
        self.steps.append(step)

    def detect_backtracking(self) -> list[int]:
        """Detect steps where agent backtracks or revises plan"""
        backtrack_indicators = [
            "let me try again",
            "that didn't work",
            "going back to",
            "alternative approach",
            "instead, i'll",
            "correction:",
            "actually,",
        ]

        backtrack_steps = []
        for step in self.steps:
            content = (step.action + " " + (step.reasoning or "")).lower()
            if any(ind in content for ind in backtrack_indicators):
                backtrack_steps.append(step.step_id)

        return backtrack_steps

    def analyze_reasoning_quality(self) -> float:
        """Score the quality of agent's reasoning"""
        if not self.steps:
            return 0.0

        quality_indicators = 0
        total_reasoning_steps = 0

        for step in self.steps:
            if step.reasoning:
                total_reasoning_steps += 1
                reasoning = step.reasoning.lower()

                # Check for quality indicators
                if "because" in reasoning or "therefore" in reasoning:
                    quality_indicators += 1
                if "step" in reasoning or "first" in reasoning or "then" in reasoning:
                    quality_indicators += 0.5
                if len(reasoning) > 50:  # Substantive reasoning
                    quality_indicators += 0.5

        if total_reasoning_steps == 0:
            return 0.5  # No reasoning = neutral

        return min(1.0, quality_indicators / (total_reasoning_steps * 2))

    def analyze_plan_coherence(self) -> float:
        """Measure how coherent the agent's plan execution is"""
        if len(self.steps) < 2:
            return 1.0

        coherence_score = 1.0
        backtrack_count = len(self.detect_backtracking())

        # Penalize for backtracking
        coherence_score -= backtrack_count * 0.1

        # Check for repeated similar actions (spinning)
        actions = [s.action for s in self.steps]
        for i in range(len(actions) - 2):
            if actions[i] == actions[i + 1] == actions[i + 2]:
                coherence_score -= 0.2  # Penalty for spinning

        return max(0.0, coherence_score)

    def detect_anomalies(self) -> list[str]:
        """Detect anomalous patterns in trajectory"""
        anomalies = []

        # Check for excessive steps
        if len(self.steps) > 20:
            anomalies.append(f"Excessive steps: {len(self.steps)}")

        # Check for repeated failures
        failed_tools = []
        for step in self.steps:
            for tc in step.tool_calls:
                if not tc.get("success", True):
                    failed_tools.append(tc.get("tool_name"))

        if len(failed_tools) > 3:
            anomalies.append(f"Multiple tool failures: {len(failed_tools)}")

        # Check for empty reasoning
        empty_reasoning = sum(1 for s in self.steps if not s.reasoning)
        if empty_reasoning > len(self.steps) * 0.5:
            anomalies.append("Insufficient reasoning in trajectory")

        return anomalies

    def calculate_efficiency(self, optimal_steps: int = None) -> float:
        """Calculate efficiency compared to optimal path"""
        if optimal_steps is None:
            # Estimate optimal as half the actual steps
            optimal_steps = max(1, len(self.steps) // 2)

        if len(self.steps) <= optimal_steps:
            return 1.0

        # Efficiency decreases as steps exceed optimal
        return optimal_steps / len(self.steps)

    def analyze(self, optimal_steps: int = None) -> TrajectoryAnalysis:
        """Generate full trajectory analysis"""
        tool_calls = sum(len(s.tool_calls) for s in self.steps)
        backtracks = self.detect_backtracking()

        return TrajectoryAnalysis(
            total_steps=len(self.steps),
            backtrack_count=len(backtracks),
            tool_call_count=tool_calls,
            reasoning_quality=self.analyze_reasoning_quality(),
            plan_coherence=self.analyze_plan_coherence(),
            efficiency_score=self.calculate_efficiency(optimal_steps),
            anomalies=self.detect_anomalies()
        )

    def to_json(self) -> str:
        """Export trajectory as JSON for logging"""
        return json.dumps([
            {
                "step_id": s.step_id,
                "action": s.action,
                "observation": s.observation,
                "reasoning": s.reasoning,
                "tool_calls": s.tool_calls,
                "timestamp": s.timestamp.isoformat()
            }
            for s in self.steps
        ], indent=2)

# Example usage
if __name__ == "__main__":
    analyzer = TrajectoryAnalyzer()

    # Simulate agent trajectory
    analyzer.add_step(TrajectoryStep(
        step_id=0,
        action="Search for flight options",
        observation="Found 5 flights",
        reasoning="First, I need to find available flights because the user wants to book travel."
    ))

    analyzer.add_step(TrajectoryStep(
        step_id=1,
        action="Compare prices",
        observation="Price comparison complete",
        reasoning="Then, I'll compare prices to find the best option.",
        tool_calls=[{"tool_name": "price_api", "success": True}]
    ))

    analyzer.add_step(TrajectoryStep(
        step_id=2,
        action="Book selected flight",
        observation="Booking confirmed",
        reasoning="Finally, I'll book the cheapest suitable flight.",
        tool_calls=[{"tool_name": "booking_api", "success": True}]
    ))

    analysis = analyzer.analyze(optimal_steps=3)

    print(f"Steps: {analysis.total_steps}")
    print(f"Backtracks: {analysis.backtrack_count}")
    print(f"Reasoning Quality: {analysis.reasoning_quality:.1%}")
    print(f"Plan Coherence: {analysis.plan_coherence:.1%}")
    print(f"Efficiency: {analysis.efficiency_score:.1%}")
    print(f"Anomalies: {analysis.anomalies}")
