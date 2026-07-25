from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol


@dataclass(frozen=True)
class Location:
    location_id: str
    owner: str
    kind: str


class Executor(Protocol):
    def apply(self, request_id: str, subject_id: str, location: Location) -> str:
        """Return an immutable receipt identifier."""


class EvidenceLedger(Protocol):
    def append(self, request_id: str, event: dict) -> None:
        """Append an event to a tamper-evident request ledger."""


def execute_subject_request(
    *,
    request_id: str,
    subject_id: str,
    locations: list[Location],
    executor: Executor,
    ledger: EvidenceLedger,
) -> dict:
    if not locations:
        raise ValueError("lineage discovery returned no owned locations")

    receipts: list[dict] = []
    for location in locations:
        receipt_id = executor.apply(request_id, subject_id, location)
        event = {
            "at": datetime.now(timezone.utc).isoformat(),
            "location_id": location.location_id,
            "owner": location.owner,
            "kind": location.kind,
            "receipt_id": receipt_id,
        }
        ledger.append(request_id, event)
        receipts.append(event)

    completed = {
        "request_id": request_id,
        "subject_id": subject_id,
        "locations_expected": len(locations),
        "receipts_recorded": len(receipts),
        "complete": len(receipts) == len(locations),
    }
    ledger.append(request_id, {"at": datetime.now(timezone.utc).isoformat(), **completed})
    return completed
