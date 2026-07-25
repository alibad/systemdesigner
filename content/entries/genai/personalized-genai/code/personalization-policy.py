"""A small, runnable policy gate for personalized request context."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable


@dataclass(frozen=True)
class ProfileClaim:
    key: str
    value: str
    purpose: str
    source: str
    confidence: float
    sensitivity: int
    expires_at: datetime
    consented: bool


@dataclass(frozen=True)
class RequestPolicy:
    purpose: str
    allowed_keys: frozenset[str]
    minimum_confidence: float = 0.75
    maximum_sensitivity: int = 2


def approved_context(
    claims: Iterable[ProfileClaim],
    policy: RequestPolicy,
    now: datetime,
) -> tuple[dict[str, str], list[str]]:
    """Return minimum approved context plus auditable rejection reasons."""
    context: dict[str, str] = {}
    rejected: list[str] = []

    for claim in claims:
        reason = None
        if claim.key not in policy.allowed_keys or claim.purpose != policy.purpose:
            reason = "not relevant to this request purpose"
        elif not claim.consented:
            reason = "consent is missing"
        elif claim.expires_at <= now:
            reason = "claim is stale"
        elif claim.confidence < policy.minimum_confidence:
            reason = "confidence is below policy"
        elif claim.sensitivity > policy.maximum_sensitivity:
            reason = "sensitivity exceeds policy"

        if reason:
            rejected.append(f"{claim.key}: {reason}")
        else:
            context[claim.key] = claim.value

    return context, rejected


def main() -> None:
    now = datetime.now(timezone.utc)
    claims = [
        ProfileClaim(
            key="explanation_format",
            value="worked-example",
            purpose="tutoring",
            source="explicit-setting",
            confidence=1.0,
            sensitivity=1,
            expires_at=now + timedelta(days=180),
            consented=True,
        ),
        ProfileClaim(
            key="account_history",
            value="premium-customer",
            purpose="support",
            source="authorized-record",
            confidence=1.0,
            sensitivity=2,
            expires_at=now + timedelta(minutes=5),
            consented=True,
        ),
        ProfileClaim(
            key="reading_level",
            value="advanced",
            purpose="tutoring",
            source="behavioral-inference",
            confidence=0.55,
            sensitivity=1,
            expires_at=now + timedelta(days=7),
            consented=True,
        ),
    ]

    tutoring = RequestPolicy("tutoring", frozenset({"explanation_format", "reading_level"}))
    support = RequestPolicy("support", frozenset({"account_history"}))

    for policy in (tutoring, support):
        context, rejected = approved_context(claims, policy, now)
        print(f"\n{policy.purpose.upper()} CONTEXT: {context or '{}'}")
        for item in rejected:
            print(f"  rejected - {item}")


if __name__ == "__main__":
    main()
