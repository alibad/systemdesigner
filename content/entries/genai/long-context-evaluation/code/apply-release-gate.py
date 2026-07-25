"""Apply predeclared long-context release gates to measured slice results."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SliceResult:
    task: str
    context_tokens: int
    evidence_depth_pct: int
    task_success: float
    citation_recall: float
    p95_latency_seconds: float


@dataclass(frozen=True)
class Gate:
    minimum_task_success: float
    minimum_citation_recall: float
    maximum_p95_latency_seconds: float


def blockers(result: SliceResult, gate: Gate) -> list[str]:
    failures: list[str] = []
    if result.task_success < gate.minimum_task_success:
        failures.append("task success below floor")
    if result.citation_recall < gate.minimum_citation_recall:
        failures.append("citation recall below floor")
    if result.p95_latency_seconds > gate.maximum_p95_latency_seconds:
        failures.append("p95 latency above budget")
    return failures


def release_decision(results: list[SliceResult], gate: Gate) -> dict:
    evaluated = [
        {"slice": result, "blockers": blockers(result, gate)}
        for result in results
    ]
    failed = [item for item in evaluated if item["blockers"]]
    return {
        "decision": "block" if failed else "canary",
        "failed_slices": failed,
        "tested_max_context": max(result.context_tokens for result in results),
    }


if __name__ == "__main__":
    policy = Gate(0.85, 0.90, 6.0)
    measured = [
        SliceResult("multi_doc_qa", 64_000, 10, 0.91, 0.94, 4.7),
        SliceResult("multi_doc_qa", 64_000, 50, 0.82, 0.88, 5.1),
        SliceResult("multi_doc_qa", 64_000, 90, 0.89, 0.92, 4.9),
    ]
    print(release_decision(measured, policy))
