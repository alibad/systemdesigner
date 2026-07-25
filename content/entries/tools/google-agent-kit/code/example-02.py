"""Bounded runtime fixture with retries, approval, and explicit stops."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class StopReason(str, Enum):
    COMPLETE = "task_complete"
    TOOL_FAILURE = "tool_retry_budget_exhausted"
    APPROVAL_DENIED = "human_approval_denied"
    MAX_TURNS = "max_turns_without_progress"
    POLICY_DENIED = "policy_scope_violation"


@dataclass(frozen=True)
class RuntimeConfig:
    max_turns: int = 5
    retry_limit: int = 1
    tool_timeout_ms: int = 1800


@dataclass
class Trace:
    events: list[dict[str, Any]] = field(default_factory=list)

    def record(self, event: str, **data: Any) -> None:
        self.events.append({"event": event, **data})


class ToolTimeout(RuntimeError):
    pass


def call_with_budget(
    tool_name: str,
    arguments: dict[str, Any],
    invoke: Callable[[dict[str, Any], int], dict[str, Any]],
    config: RuntimeConfig,
    trace: Trace,
) -> dict[str, Any]:
    """Retry only transient timeouts and expose every attempt."""
    for attempt in range(config.retry_limit + 1):
        try:
            result = invoke(arguments, config.tool_timeout_ms)
            trace.record(
                "tool_result",
                tool=tool_name,
                attempt=attempt + 1,
                status="success",
            )
            return result
        except ToolTimeout:
            trace.record(
                "tool_result",
                tool=tool_name,
                attempt=attempt + 1,
                status="timeout",
            )

    raise ToolTimeout(StopReason.TOOL_FAILURE.value)


def run_agent(
    plan_next: Callable[[list[dict[str, Any]]], dict[str, Any]],
    approve: Callable[[str, dict[str, Any]], bool],
    invoke: Callable[[str, dict[str, Any], int], dict[str, Any]],
    config: RuntimeConfig,
) -> tuple[StopReason, Trace]:
    """Execute observable decisions without exposing private model reasoning."""
    trace = Trace()
    observations: list[dict[str, Any]] = []
    previous_action: dict[str, Any] | None = None

    for turn in range(1, config.max_turns + 1):
        action = plan_next(observations)
        trace.record("plan", turn=turn, action=action["name"])

        if action["name"] == "finish":
            trace.record("stop", reason=StopReason.COMPLETE.value)
            return StopReason.COMPLETE, trace

        if action == previous_action:
            trace.record("no_progress", turn=turn, action=action["name"])
        previous_action = action

        if action.get("policy") == "deny":
            trace.record("stop", reason=StopReason.POLICY_DENIED.value)
            return StopReason.POLICY_DENIED, trace

        if action.get("approval_key"):
            approved = approve(action["approval_key"], action["arguments"])
            trace.record("approval", approved=approved)
            if not approved:
                trace.record("stop", reason=StopReason.APPROVAL_DENIED.value)
                return StopReason.APPROVAL_DENIED, trace

        try:
            result = call_with_budget(
                action["name"],
                action["arguments"],
                lambda arguments, timeout: invoke(
                    action["name"], arguments, timeout
                ),
                config,
                trace,
            )
        except ToolTimeout:
            trace.record("stop", reason=StopReason.TOOL_FAILURE.value)
            return StopReason.TOOL_FAILURE, trace

        observations.append(result)

    trace.record("stop", reason=StopReason.MAX_TURNS.value)
    return StopReason.MAX_TURNS, trace
