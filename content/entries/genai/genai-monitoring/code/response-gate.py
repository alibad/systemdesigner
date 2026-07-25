"""Choose a bounded production response from independent guardrails and evidence."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Guardrails:
    minimum_quality_pct: float
    maximum_cost_per_success_usd: float
    maximum_p95_latency_ms: int


@dataclass(frozen=True)
class Observation:
    quality_pct: float
    cost_per_success_usd: float
    p95_latency_ms: int
    slice_coverage_pct: float
    reproduced: bool
    release_attributed: bool
    rollback_target: str | None


@dataclass(frozen=True)
class Decision:
    action: str
    breached: tuple[str, ...]
    explanation: str


def decide(guardrails: Guardrails, observation: Observation) -> Decision:
    breached: list[str] = []
    if observation.quality_pct < guardrails.minimum_quality_pct:
        breached.append("quality")
    if observation.cost_per_success_usd > guardrails.maximum_cost_per_success_usd:
        breached.append("cost")
    if observation.p95_latency_ms > guardrails.maximum_p95_latency_ms:
        breached.append("latency")

    if not breached:
        return Decision(
            "continue bounded canary",
            (),
            "All independent guardrails pass; continue monitoring the declared slices.",
        )

    evidence_ready = (
        observation.slice_coverage_pct >= 75.0
        and observation.reproduced
        and observation.release_attributed
    )
    rollback_worthy = "quality" in breached or "latency" in breached

    if evidence_ready and rollback_worthy and observation.rollback_target:
        return Decision(
            f"roll back to {observation.rollback_target}",
            tuple(breached),
            "The user-visible breach is reproduced, release-attributed, and recoverable.",
        )

    if not evidence_ready:
        return Decision(
            "cap exposure and escalate evaluation",
            tuple(breached),
            "The boundary is crossed, but coverage or attribution is too weak for a causal claim.",
        )

    return Decision(
        "route or rate-limit the expensive path",
        tuple(breached),
        "Evidence supports an isolated cost mitigation without removing healthy behavior.",
    )


if __name__ == "__main__":
    policy = Guardrails(88.0, 0.08, 4_000)
    release = Observation(
        quality_pct=79.0,
        cost_per_success_usd=0.07,
        p95_latency_ms=5_200,
        slice_coverage_pct=92.0,
        reproduced=True,
        release_attributed=True,
        rollback_target="prompt-18",
    )
    result = decide(policy, release)
    print(f"action={result.action}")
    print(f"breached={','.join(result.breached)}")
    print(result.explanation)
