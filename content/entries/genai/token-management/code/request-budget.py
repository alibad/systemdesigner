"""Allocate a model context without silently truncating protected content."""

from dataclasses import asdict, dataclass
from typing import Literal


Policy = Literal["recent-first", "evidence-first", "summarize-history"]


@dataclass(frozen=True)
class RequestShape:
    context_window: int
    fixed_tokens: int
    current_input_tokens: int
    history_turns: int
    tokens_per_turn: int
    retrieved_chunks: int
    tokens_per_chunk: int
    output_reserve: int
    minimum_output: int


@dataclass(frozen=True)
class Allocation:
    admitted: bool
    policy: Policy
    fixed_tokens: int
    current_input_tokens: int
    history_tokens: int
    retrieved_tokens: int
    output_reserve: int
    retained_history_turns: int
    retained_chunks: int
    unused_tokens: int
    reason: str


def allocate_context(request: RequestShape, policy: Policy) -> Allocation:
    protected = request.fixed_tokens + request.current_input_tokens + request.output_reserve
    if request.output_reserve < request.minimum_output:
        return Allocation(
            False,
            policy,
            request.fixed_tokens,
            request.current_input_tokens,
            0,
            0,
            request.output_reserve,
            0,
            0,
            max(0, request.context_window - protected),
            "output reserve is below the task contract",
        )
    if protected > request.context_window:
        return Allocation(
            False,
            policy,
            request.fixed_tokens,
            request.current_input_tokens,
            0,
            0,
            request.output_reserve,
            0,
            0,
            0,
            "protected content exceeds the context window",
        )

    remaining = request.context_window - protected
    history_demand = request.history_turns * request.tokens_per_turn
    retrieval_demand = request.retrieved_chunks * request.tokens_per_chunk

    if policy == "summarize-history" and request.history_turns:
        # A real summary must be generated, evaluated, versioned, and linked to source turns.
        history_demand = min(history_demand, 480 + request.history_turns * 24)

    if policy == "recent-first":
        history_tokens = min(history_demand, remaining)
        remaining -= history_tokens
        retrieved_tokens = min(retrieval_demand, remaining)
    else:
        retrieved_tokens = min(retrieval_demand, remaining)
        remaining -= retrieved_tokens
        history_tokens = min(history_demand, remaining)

    retained_chunks = min(
        request.retrieved_chunks,
        retrieved_tokens // request.tokens_per_chunk,
    )
    if policy == "summarize-history" and history_tokens == history_demand:
        retained_turns = request.history_turns
    else:
        retained_turns = min(
            request.history_turns,
            history_tokens // request.tokens_per_turn,
        )

    used = protected + history_tokens + retrieved_tokens
    return Allocation(
        True,
        policy,
        request.fixed_tokens,
        request.current_input_tokens,
        history_tokens,
        retrieved_tokens,
        request.output_reserve,
        retained_turns,
        retained_chunks,
        request.context_window - used,
        "request admitted with an explicit allocation",
    )


if __name__ == "__main__":
    example = RequestShape(
        context_window=16_384,
        fixed_tokens=1_700,
        current_input_tokens=900,
        history_turns=12,
        tokens_per_turn=520,
        retrieved_chunks=7,
        tokens_per_chunk=780,
        output_reserve=2_000,
        minimum_output=1_200,
    )
    for allocation_policy in ("recent-first", "evidence-first", "summarize-history"):
        print(asdict(allocate_context(example, allocation_policy)))
