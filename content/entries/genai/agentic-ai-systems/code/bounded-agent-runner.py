from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class RunLimits:
    max_steps: int
    max_tool_calls: int
    deadline_ms: int


@dataclass
class RunState:
    run_id: str
    step: int = 0
    tool_calls: int = 0
    status: str = "created"


class Planner(Protocol):
    async def next_action(self, state: RunState) -> dict[str, Any]: ...


class ToolGateway(Protocol):
    async def invoke(
        self,
        *,
        run_id: str,
        call_id: str,
        tool: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]: ...


async def run_bounded(
    state: RunState,
    limits: RunLimits,
    planner: Planner,
    tools: ToolGateway,
) -> RunState:
    """A control-plane sketch, not a production agent framework."""
    state.status = "running"

    while state.step < limits.max_steps:
        proposal = await planner.next_action(state)
        state.step += 1

        if proposal["kind"] == "finish":
            state.status = "completed"
            return state

        if proposal["kind"] != "tool":
            state.status = "invalid_proposal"
            return state

        if state.tool_calls >= limits.max_tool_calls:
            state.status = "tool_budget_exhausted"
            return state

        # Authorization is enforced by code at execution time, not by the prompt.
        if proposal["requires_approval"]:
            await save_checkpoint(state, pending=proposal)
            state.status = "waiting_for_approval"
            return state

        state.tool_calls += 1
        call_id = f"{state.run_id}:{state.tool_calls}"
        result = await tools.invoke(
            run_id=state.run_id,
            call_id=call_id,
            tool=proposal["tool"],
            arguments=proposal["arguments"],
        )

        # Tool output is untrusted data. Validate its schema and authority claims
        # before it can influence another proposal.
        await record_observation(state, validate_tool_result(result))
        await save_checkpoint(state)

    state.status = "step_budget_exhausted"
    return state


def validate_tool_result(result: dict[str, Any]) -> dict[str, Any]:
    if set(result) - {"status", "data", "operation_id"}:
        raise ValueError("unexpected tool-result fields")
    return result


async def save_checkpoint(
    state: RunState,
    *,
    pending: dict[str, Any] | None = None,
) -> None:
    """Persist state and pending approval atomically in the real implementation."""
    raise NotImplementedError


async def record_observation(state: RunState, result: dict[str, Any]) -> None:
    """Append a redacted, versioned observation to the durable run record."""
    raise NotImplementedError
