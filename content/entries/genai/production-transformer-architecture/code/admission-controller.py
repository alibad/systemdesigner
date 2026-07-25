"""A small, deterministic admission boundary for a token-serving pool."""

from dataclasses import dataclass
from enum import Enum


class Decision(str, Enum):
    ADMIT = "admit"
    QUEUE = "queue"
    REJECT = "reject"


@dataclass(frozen=True)
class RequestBudget:
    request_id: str
    prompt_tokens: int
    max_output_tokens: int
    deadline_ms: int

    @property
    def maximum_tokens(self) -> int:
        return self.prompt_tokens + self.max_output_tokens


@dataclass(frozen=True)
class PoolSnapshot:
    healthy_replicas: int
    free_kv_pages: int
    tokens_per_page: int
    queue_depth: int
    oldest_queue_age_ms: int
    max_queue_depth: int
    max_queue_age_ms: int
    max_request_tokens: int


@dataclass(frozen=True)
class AdmissionResult:
    decision: Decision
    reason: str
    reserved_pages: int = 0


def pages_for(tokens: int, tokens_per_page: int) -> int:
    if tokens <= 0 or tokens_per_page <= 0:
        raise ValueError("token counts must be positive")
    return (tokens + tokens_per_page - 1) // tokens_per_page


def decide(request: RequestBudget, pool: PoolSnapshot) -> AdmissionResult:
    if request.maximum_tokens > pool.max_request_tokens:
        return AdmissionResult(Decision.REJECT, "request exceeds the pool token contract")

    if pool.healthy_replicas == 0:
        return AdmissionResult(Decision.REJECT, "no complete serving replica is healthy")

    required_pages = pages_for(request.maximum_tokens, pool.tokens_per_page)
    if required_pages <= pool.free_kv_pages:
        return AdmissionResult(
            Decision.ADMIT,
            "token and KV-page reservations fit the current snapshot",
            reserved_pages=required_pages,
        )

    queue_expired = pool.oldest_queue_age_ms >= min(
        pool.max_queue_age_ms,
        request.deadline_ms,
    )
    queue_full = pool.queue_depth >= pool.max_queue_depth
    if queue_expired or queue_full:
        return AdmissionResult(Decision.REJECT, "bounded queue cannot accept more work")

    return AdmissionResult(Decision.QUEUE, "wait for cache pages within the request deadline")


def main() -> None:
    request = RequestBudget(
        request_id="req-2048",
        prompt_tokens=6144,
        max_output_tokens=1024,
        deadline_ms=2500,
    )
    healthy_pool = PoolSnapshot(
        healthy_replicas=2,
        free_kv_pages=40,
        tokens_per_page=256,
        queue_depth=8,
        oldest_queue_age_ms=120,
        max_queue_depth=64,
        max_queue_age_ms=1500,
        max_request_tokens=8192,
    )
    degraded_pool = PoolSnapshot(
        **{**healthy_pool.__dict__, "healthy_replicas": 0}
    )

    admitted = decide(request, healthy_pool)
    rejected = decide(request, degraded_pool)
    print(admitted)
    print(rejected)

    assert admitted.decision is Decision.ADMIT
    assert admitted.reserved_pages == 28
    assert rejected.decision is Decision.REJECT


if __name__ == "__main__":
    main()
