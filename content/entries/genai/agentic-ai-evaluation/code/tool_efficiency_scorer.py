"""
Tool Usage Efficiency Scoring
Measure how efficiently an agent uses available tools
"""

from dataclasses import dataclass
from collections import Counter

@dataclass
class ToolCall:
    """Record of a single tool call"""
    tool_name: str
    parameters: dict
    success: bool
    latency_ms: float
    result_used: bool  # Was the result actually used in next step?

@dataclass
class ToolEfficiencyScore:
    """Comprehensive tool efficiency metrics"""
    total_calls: int
    unique_tools_used: int
    success_rate: float
    redundancy_rate: float  # Duplicate calls with same params
    error_recovery_rate: float  # Successful retry after failure
    result_utilization: float  # How often results were used
    avg_latency_ms: float
    efficiency_score: float  # Overall 0-100 score

class ToolEfficiencyEvaluator:
    """Evaluate agent tool usage efficiency"""

    def __init__(self, available_tools: list[str]):
        self.available_tools = set(available_tools)
        self.tool_calls: list[ToolCall] = []

    def record_call(self, call: ToolCall):
        """Record a tool call"""
        self.tool_calls.append(call)

    def _calculate_redundancy(self) -> float:
        """Calculate rate of redundant tool calls"""
        if len(self.tool_calls) <= 1:
            return 0.0

        # Check for duplicate (tool, params) combinations
        call_signatures = []
        for call in self.tool_calls:
            sig = (call.tool_name, str(sorted(call.parameters.items())))
            call_signatures.append(sig)

        counts = Counter(call_signatures)
        redundant = sum(c - 1 for c in counts.values() if c > 1)
        return redundant / len(self.tool_calls)

    def _calculate_error_recovery(self) -> float:
        """Calculate successful recovery rate after errors"""
        failures = []
        for i, call in enumerate(self.tool_calls):
            if not call.success:
                failures.append(i)

        if not failures:
            return 1.0  # No failures = perfect recovery

        recoveries = 0
        for fail_idx in failures:
            # Check if same tool was successfully called after failure
            failed_tool = self.tool_calls[fail_idx].tool_name
            for later_call in self.tool_calls[fail_idx + 1:]:
                if later_call.tool_name == failed_tool and later_call.success:
                    recoveries += 1
                    break

        return recoveries / len(failures)

    def evaluate(self) -> ToolEfficiencyScore:
        """Generate comprehensive efficiency score"""
        if not self.tool_calls:
            return ToolEfficiencyScore(
                total_calls=0, unique_tools_used=0, success_rate=1.0,
                redundancy_rate=0.0, error_recovery_rate=1.0,
                result_utilization=1.0, avg_latency_ms=0.0, efficiency_score=100.0
            )

        total = len(self.tool_calls)
        unique_tools = len(set(c.tool_name for c in self.tool_calls))
        successes = sum(1 for c in self.tool_calls if c.success)
        results_used = sum(1 for c in self.tool_calls if c.result_used)
        total_latency = sum(c.latency_ms for c in self.tool_calls)

        success_rate = successes / total
        redundancy = self._calculate_redundancy()
        recovery = self._calculate_error_recovery()
        utilization = results_used / total

        # Calculate overall efficiency score (0-100)
        # Weights: success (30%), low redundancy (25%), recovery (20%), utilization (25%)
        efficiency = (
            success_rate * 30 +
            (1 - redundancy) * 25 +
            recovery * 20 +
            utilization * 25
        )

        return ToolEfficiencyScore(
            total_calls=total,
            unique_tools_used=unique_tools,
            success_rate=success_rate,
            redundancy_rate=redundancy,
            error_recovery_rate=recovery,
            result_utilization=utilization,
            avg_latency_ms=total_latency / total,
            efficiency_score=efficiency
        )

def compare_agent_efficiency(
    baseline_calls: list[ToolCall],
    test_calls: list[ToolCall],
    available_tools: list[str]
) -> dict:
    """Compare efficiency between baseline and test agent"""
    baseline_eval = ToolEfficiencyEvaluator(available_tools)
    for call in baseline_calls:
        baseline_eval.record_call(call)

    test_eval = ToolEfficiencyEvaluator(available_tools)
    for call in test_calls:
        test_eval.record_call(call)

    baseline_score = baseline_eval.evaluate()
    test_score = test_eval.evaluate()

    return {
        "baseline": baseline_score,
        "test": test_score,
        "improvement": {
            "efficiency_delta": test_score.efficiency_score - baseline_score.efficiency_score,
            "call_reduction": baseline_score.total_calls - test_score.total_calls,
            "success_improvement": test_score.success_rate - baseline_score.success_rate
        }
    }

# Example usage
if __name__ == "__main__":
    evaluator = ToolEfficiencyEvaluator(["search", "create", "update", "delete"])

    # Record some tool calls
    evaluator.record_call(ToolCall("search", {"query": "test"}, True, 150, True))
    evaluator.record_call(ToolCall("search", {"query": "test"}, True, 145, False))  # Redundant!
    evaluator.record_call(ToolCall("create", {"data": "new"}, False, 200, False))  # Failed
    evaluator.record_call(ToolCall("create", {"data": "new"}, True, 180, True))  # Recovered

    score = evaluator.evaluate()
    print(f"Efficiency Score: {score.efficiency_score:.1f}/100")
    print(f"Success Rate: {score.success_rate:.1%}")
    print(f"Redundancy Rate: {score.redundancy_rate:.1%}")
