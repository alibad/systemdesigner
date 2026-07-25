"""Small state machine for containing an agent security incident.

The sequence demonstrates that restart is not recovery. Run with:
python3 incident-containment.py
"""

from dataclasses import dataclass, field


@dataclass
class Incident:
    incident_id: str
    principal_id: str
    affected_memory_namespace: str
    paused: bool = False
    credentials_revoked: bool = False
    context_quarantined: bool = False
    evidence_ids: list[str] = field(default_factory=list)
    effects_reconciled: bool = False
    clean_canary_passed: bool = False

    def preserve_evidence(self, *event_ids: str) -> None:
        self.evidence_ids.extend(event_ids)

    def contain(self) -> None:
        self.paused = True
        self.credentials_revoked = True
        self.context_quarantined = True

    def reconcile(self, observed_effect_ids: set[str], ledger_effect_ids: set[str]) -> None:
        if not self.paused:
            raise RuntimeError("pause the principal before reconciling effects")
        missing_from_trace = ledger_effect_ids - observed_effect_ids
        if missing_from_trace:
            raise RuntimeError(f"unattributed effects: {sorted(missing_from_trace)}")
        self.effects_reconciled = True

    def recover_with_canary(self) -> None:
        required = {
            "principal paused": self.paused,
            "credentials revoked": self.credentials_revoked,
            "context quarantined": self.context_quarantined,
            "evidence preserved": bool(self.evidence_ids),
            "effects reconciled": self.effects_reconciled,
        }
        missing = [name for name, ready in required.items() if not ready]
        if missing:
            raise RuntimeError(f"recovery blocked: {', '.join(missing)}")
        self.clean_canary_passed = True


incident = Incident(
    incident_id="inc-2026-0719",
    principal_id="agent-finance-7",
    affected_memory_namespace="tenant-blue/payables",
)

incident.preserve_evidence("trajectory-884", "tool-call-219", "approval-91")
incident.contain()
incident.reconcile(
    observed_effect_ids={"payment-review-18"},
    ledger_effect_ids={"payment-review-18"},
)
incident.recover_with_canary()

print(
    {
        "incident": incident.incident_id,
        "contained": incident.paused and incident.credentials_revoked,
        "context_quarantined": incident.context_quarantined,
        "evidence_events": len(incident.evidence_ids),
        "effects_reconciled": incident.effects_reconciled,
        "clean_canary_passed": incident.clean_canary_passed,
    }
)
