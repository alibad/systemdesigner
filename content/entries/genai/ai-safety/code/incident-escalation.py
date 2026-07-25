"""Classify an AI incident and produce a concrete first-response contract."""

from dataclasses import dataclass
from enum import Enum


class Response(str, Enum):
    INVESTIGATE = "investigate"
    RESTRICT = "restrict affected path"
    SHUT_DOWN = "rollback or shut down"


@dataclass(frozen=True)
class IncidentSignal:
    active_harm: bool
    unauthorized_action: bool
    sensitive_data_exposed: bool
    affected_users_per_minute: int
    safe_fallback_available: bool


@dataclass(frozen=True)
class ResponseContract:
    response: Response
    owner: str
    preserve: tuple[str, ...]
    success_condition: str


def first_response(signal: IncidentSignal) -> ResponseContract:
    """Escalate from observed impact, not from model confidence alone."""
    critical = signal.unauthorized_action or signal.sensitive_data_exposed
    high_reach = signal.affected_users_per_minute >= 10

    if critical or (signal.active_harm and high_reach):
        response = (
            Response.RESTRICT if signal.safe_fallback_available else Response.SHUT_DOWN
        )
        owner = "security or safety incident commander"
    elif signal.active_harm:
        response = Response.RESTRICT
        owner = "product safety on-call"
    else:
        response = Response.INVESTIGATE
        owner = "service owner"

    return ResponseContract(
        response=response,
        owner=owner,
        preserve=(
            "incident timestamp and affected cohort",
            "model, prompt, policy, retrieval, and tool versions",
            "minimized decision trace and containment actions",
        ),
        success_condition="harm stops and the affected path stays attributable",
    )


if __name__ == "__main__":
    leak = IncidentSignal(
        active_harm=True,
        unauthorized_action=False,
        sensitive_data_exposed=True,
        affected_users_per_minute=18,
        safe_fallback_available=False,
    )
    assert first_response(leak).response is Response.SHUT_DOWN
