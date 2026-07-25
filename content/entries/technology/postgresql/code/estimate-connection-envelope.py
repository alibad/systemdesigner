"""Estimate a PostgreSQL connection and memory envelope without dependencies."""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class Envelope:
    active_queries: int
    operator_memory_gb: float
    committed_memory_gb: float
    headroom_gb: float
    queue_delay_ms: int


def estimate_envelope(
    *,
    host_ram_gb: float,
    clients: int,
    backends: int,
    active_query_percent: float,
    operators_per_query: float,
    average_query_ms: float,
    shared_buffers_gb: float,
    work_mem_mb: float,
    connection_overhead_mb: float = 8,
    os_reserve_gb: float = 5,
    maintenance_reserve_gb: float = 4,
) -> Envelope:
    if min(host_ram_gb, clients, backends, work_mem_mb) <= 0:
        raise ValueError("host, client, backend, and memory inputs must be positive")

    active_queries = max(1, min(backends, ceil(clients * active_query_percent / 100)))
    operator_memory_gb = active_queries * operators_per_query * work_mem_mb / 1024
    connection_memory_gb = backends * connection_overhead_mb / 1024
    committed_memory_gb = (
        shared_buffers_gb
        + operator_memory_gb
        + connection_memory_gb
        + os_reserve_gb
        + maintenance_reserve_gb
    )
    queue_waves = max(0, clients / backends - 1)

    return Envelope(
        active_queries=active_queries,
        operator_memory_gb=operator_memory_gb,
        committed_memory_gb=committed_memory_gb,
        headroom_gb=host_ram_gb - committed_memory_gb,
        queue_delay_ms=round(queue_waves * average_query_ms),
    )


if __name__ == "__main__":
    healthy = estimate_envelope(
        host_ram_gb=32,
        clients=800,
        backends=80,
        active_query_percent=8,
        operators_per_query=1.2,
        average_query_ms=18,
        shared_buffers_gb=8,
        work_mem_mb=16,
    )
    reporting = estimate_envelope(
        host_ram_gb=32,
        clients=800,
        backends=300,
        active_query_percent=65,
        operators_per_query=4.5,
        average_query_ms=620,
        shared_buffers_gb=16,
        work_mem_mb=64,
    )

    assert healthy.headroom_gb > 8
    assert reporting.headroom_gb < 0
    print(f"healthy headroom: {healthy.headroom_gb:.1f} GB")
    print(f"reporting headroom: {reporting.headroom_gb:.1f} GB")
