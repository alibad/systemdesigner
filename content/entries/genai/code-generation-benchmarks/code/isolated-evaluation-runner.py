"""Orchestrate an isolated code-evaluation job.

This is intentionally not a sandbox implementation. The `submit_isolated_job` adapter
must target a hardened workload runtime that enforces the policy outside candidate code.
"""

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class EvaluationPolicy:
    image_digest: str
    timeout_seconds: int
    memory_mb: int
    cpu_millis: int
    allow_network: bool = False
    read_only_root: bool = True


def evaluate_candidate(
    candidate_source: str,
    test_bundle: bytes,
    policy: EvaluationPolicy,
) -> dict[str, object]:
    """Submit code and tests to a separate, policy-enforcing execution service."""
    if policy.allow_network:
        raise ValueError("Benchmark candidates must not receive network access")
    if not policy.read_only_root:
        raise ValueError("The runner root filesystem must be read-only")

    request = {
        "image_digest": policy.image_digest,
        "source": candidate_source,
        "test_bundle": test_bundle,
        "limits": {
            "timeout_seconds": policy.timeout_seconds,
            "memory_mb": policy.memory_mb,
            "cpu_millis": policy.cpu_millis,
            "max_processes": 1,
            "max_output_bytes": 64_000,
        },
        "filesystem": {"task_read_only": True, "scratch_bytes": 8_000_000},
        "network": "none",
    }
    return submit_isolated_job(request)


def score_task(results: Iterable[dict[str, object]]) -> bool:
    """A task passes only when one isolated candidate passes every declared test."""
    return any(result.get("status") == "all_tests_passed" for result in results)


def submit_isolated_job(request: dict[str, object]) -> dict[str, object]:
    """Replace with a platform-specific queue client; never execute `source` here."""
    raise NotImplementedError("Use a hardened external workload runner")
