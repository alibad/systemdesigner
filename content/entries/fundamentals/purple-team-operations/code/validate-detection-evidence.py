from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class Evidence:
    technique_id: str
    test_id: str
    telemetry_event_id: str
    alert_id: str
    case_id: str
    control_version: str
    retest_passed: bool
    recorded_at: datetime


def validate_evidence(record: Evidence) -> list[str]:
    """Return missing proof instead of collapsing evidence into one score."""
    missing: list[str] = []
    for field in (
        "technique_id",
        "test_id",
        "telemetry_event_id",
        "alert_id",
        "case_id",
        "control_version",
    ):
        if not getattr(record, field).strip():
            missing.append(field)

    if record.recorded_at.tzinfo is None:
        missing.append("recorded_at timezone")
    if not record.retest_passed:
        missing.append("successful authorized retest")
    return missing


evidence = Evidence(
    technique_id="T1059.001",
    test_id="pt-2026-07-23-014",
    telemetry_event_id="endpoint-event-8842",
    alert_id="alert-2901",
    case_id="case-771",
    control_version="powershell-analytic-v7",
    retest_passed=True,
    recorded_at=datetime.now(timezone.utc),
)

assert validate_evidence(evidence) == []
