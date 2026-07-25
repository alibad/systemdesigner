from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta


@dataclass(frozen=True)
class Evidence:
    evidence_id: str
    tenant_id: str
    source: str
    fact: str
    observed_at: datetime
    expires_at: datetime


@dataclass
class WorkingState:
    run_id: str
    tenant_id: str
    goal: str
    remaining_steps: int
    evidence_ids: list[str] = field(default_factory=list)
    pending_approval_id: str | None = None


@dataclass(frozen=True)
class DurableCheckpoint:
    run_id: str
    status: str
    completed_step_ids: tuple[str, ...]
    side_effect_ids: tuple[str, ...]
    pending_approval_id: str | None


class EvidenceStore:
    def __init__(self) -> None:
        self._records: dict[str, Evidence] = {}

    def put(self, record: Evidence) -> None:
        self._records[record.evidence_id] = record

    def get_for_run(
        self,
        evidence_id: str,
        state: WorkingState,
        now: datetime,
    ) -> Evidence:
        record = self._records[evidence_id]
        if record.tenant_id != state.tenant_id:
            raise PermissionError("cross-tenant memory access denied")
        if record.expires_at <= now:
            raise ValueError("memory record is stale")
        return record


now = datetime.now(UTC)
store = EvidenceStore()
store.put(
    Evidence(
        evidence_id="evidence-order-417",
        tenant_id="tenant-a",
        source="orders-api:v3",
        fact="Order 417 total is USD 80.00",
        observed_at=now,
        expires_at=now + timedelta(minutes=10),
    )
)

working = WorkingState(
    run_id="run-1042",
    tenant_id="tenant-a",
    goal="Prepare a refund recommendation",
    remaining_steps=3,
    evidence_ids=["evidence-order-417"],
)

evidence = store.get_for_run("evidence-order-417", working, now)
checkpoint = DurableCheckpoint(
    run_id=working.run_id,
    status="needs_approval",
    completed_step_ids=("read-order", "calculate-eligibility"),
    side_effect_ids=(),
    pending_approval_id="approval-88",
)

print(evidence.source, checkpoint.status)
