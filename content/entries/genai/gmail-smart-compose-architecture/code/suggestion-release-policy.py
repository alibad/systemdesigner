from dataclasses import dataclass


@dataclass(frozen=True)
class Candidate:
    text: str
    confidence: float
    age_ms: int
    prefix_matches: bool
    policy_safe: bool
    language_matches: bool


@dataclass(frozen=True)
class ReleasePolicy:
    confidence_floor: float = 0.78
    maximum_age_ms: int = 60


def release(candidate: Candidate, policy: ReleasePolicy) -> tuple[bool, list[str]]:
    failures: list[str] = []

    if candidate.confidence < policy.confidence_floor:
        failures.append("confidence below the display threshold")
    if candidate.age_ms > policy.maximum_age_ms:
        failures.append("candidate arrived after its freshness budget")
    if not candidate.prefix_matches:
        failures.append("the draft changed after generation started")
    if not candidate.policy_safe:
        failures.append("candidate failed the content policy")
    if not candidate.language_matches:
        failures.append("candidate does not match the active writing language")

    return not failures, failures


if __name__ == "__main__":
    candidate = Candidate(
        text="I'll send the agenda before noon.",
        confidence=0.86,
        age_ms=43,
        prefix_matches=True,
        policy_safe=True,
        language_matches=True,
    )
    allowed, reasons = release(candidate, ReleasePolicy())
    print("render" if allowed else "suppress")
    for reason in reasons:
        print(f"- {reason}")
