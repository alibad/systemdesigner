"""Locality-aware routing with deadline and warm-capacity checks."""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class Worker:
    worker_id: str
    zone: str
    ready: bool
    resident_models: frozenset[str]
    active_requests: int
    max_concurrency: int
    predicted_service_ms: int


def route_score(worker: Worker, model_id: str, remaining_ms: int) -> float:
    """Lower scores are better; incompatible workers are excluded by infinity."""
    if not worker.ready or worker.active_requests >= worker.max_concurrency:
        return float("inf")

    queue_waves = worker.active_requests / max(worker.max_concurrency, 1)
    predicted_finish_ms = worker.predicted_service_ms * (1 + queue_waves)
    if predicted_finish_ms >= remaining_ms:
        return float("inf")

    cold_load_penalty = 0 if model_id in worker.resident_models else 5
    load_penalty = 4 * queue_waves
    return cold_load_penalty + load_penalty


def choose_worker(workers: list[Worker], model_id: str, remaining_ms: int) -> Worker | None:
    eligible = [worker for worker in workers if route_score(worker, model_id, remaining_ms) < float("inf")]
    return min(eligible, key=lambda worker: route_score(worker, model_id, remaining_ms), default=None)


def warm_replica_target(
    arrival_rps: float,
    service_ms: float,
    concurrency_per_replica: int,
    target_utilization: float = 0.70,
    failure_headroom: int = 1,
) -> int:
    if not 0 < target_utilization < 1:
        raise ValueError("target utilization must be between zero and one")
    per_replica_rps = concurrency_per_replica * 1000 / service_ms
    steady_replicas = ceil(arrival_rps / (per_replica_rps * target_utilization))
    return steady_replicas + failure_headroom


if __name__ == "__main__":
    fleet = [
        Worker("gpu-a", "zone-a", True, frozenset({"ranker-v7"}), 4, 8, 62),
        Worker("gpu-b", "zone-b", True, frozenset({"embedder-v3"}), 1, 8, 62),
        Worker("gpu-c", "zone-c", False, frozenset({"ranker-v7"}), 0, 8, 62),
    ]
    selected = choose_worker(fleet, model_id="ranker-v7", remaining_ms=150)
    target = warm_replica_target(120, service_ms=62, concurrency_per_replica=8)
    print(f"selected_worker={selected.worker_id if selected else 'reject-or-fallback'}")
    print(f"warm_replica_target={target}")
