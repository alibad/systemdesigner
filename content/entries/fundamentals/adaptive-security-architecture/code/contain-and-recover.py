"""Gate recovery on containment, remediation, and verification.

The state machine keeps response steps explicit and blocks premature restore.
Run with: python3 contain-and-recover.py
"""

from dataclasses import dataclass, field


@dataclass
class Incident:
    incident_id: str
    active_paths: set[str]
    preserved_events: list[str] = field(default_factory=list)
    blocked_paths: set[str] = field(default_factory=set)
    credentials_rotated: bool = False
    cause_remediated: bool = False
    canary_verified: bool = False

    def preserve_evidence(self, *event_ids: str) -> None:
        self.preserved_events.extend(event_ids)

    def contain(self, *paths: str) -> None:
        self.blocked_paths.update(paths)

    def mark_remediated(self, *, credentials_rotated: bool) -> None:
        self.credentials_rotated = credentials_rotated
        self.cause_remediated = True

    def verify_canary(self) -> None:
        if not self.cause_remediated:
            raise RuntimeError("repair the cause before running a recovery canary")
        self.canary_verified = True

    def authorize_recovery(self) -> None:
        missing: list[str] = []
        uncovered = self.active_paths - self.blocked_paths
        if uncovered:
            missing.append(f"contain paths {sorted(uncovered)}")
        if not self.preserved_events:
            missing.append("preserve decision and enforcement evidence")
        if not self.credentials_rotated:
            missing.append("rotate exposed credentials")
        if not self.cause_remediated:
            missing.append("remediate the cause")
        if not self.canary_verified:
            missing.append("verify a bounded canary")
        if missing:
            raise RuntimeError(f"recovery blocked: {'; '.join(missing)}")


incident = Incident(
    incident_id="inc-1042",
    active_paths={"session", "device"},
)
incident.preserve_evidence("decision-891", "endpoint-ack-207", "token-use-334")
incident.contain("session", "device")
incident.mark_remediated(credentials_rotated=True)
incident.verify_canary()
incident.authorize_recovery()

print(
    {
        "incident": incident.incident_id,
        "contained": incident.active_paths <= incident.blocked_paths,
        "evidence_events": len(incident.preserved_events),
        "recovery_authorized": True,
    }
)
