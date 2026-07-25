"""Authorize and deduplicate a side-effecting tool outside the model loop."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    permissions: frozenset[str]


@dataclass(frozen=True)
class RefundRequest:
    payment_id: str
    tenant_id: str
    amount: Decimal
    approved_by: str | None
    idempotency_key: str


class RefundBoundary:
    """A small stand-in for policy and durable outcome storage."""

    def __init__(self) -> None:
        self._payment_tenants = {"pay_123": "tenant_a"}
        self._outcomes: dict[tuple[str, str], dict[str, str]] = {}

    def execute(self, principal: Principal, request: RefundRequest) -> dict[str, str]:
        if "payments:refund" not in principal.permissions:
            raise PermissionError("principal cannot refund payments")

        owner = self._payment_tenants.get(request.payment_id)
        if owner is None or owner != principal.tenant_id or owner != request.tenant_id:
            raise PermissionError("payment is outside the caller's tenant and resource scope")

        if request.amount <= 0:
            raise ValueError("refund amount must be positive")
        if not request.approved_by:
            raise PermissionError("refund requires a trusted approval record")
        if not request.idempotency_key:
            raise ValueError("refund requires an idempotency key")

        outcome_key = (principal.tenant_id, request.idempotency_key)
        if outcome_key in self._outcomes:
            return self._outcomes[outcome_key]

        outcome = {
            "status": "accepted",
            "payment_id": request.payment_id,
            "refund_id": "refund_001",
        }
        self._outcomes[outcome_key] = outcome
        return outcome


if __name__ == "__main__":
    boundary = RefundBoundary()
    caller = Principal(
        user_id="user_42",
        tenant_id="tenant_a",
        permissions=frozenset({"payments:refund"}),
    )
    request = RefundRequest(
        payment_id="pay_123",
        tenant_id="tenant_a",
        amount=Decimal("25.00"),
        approved_by="reviewer_7",
        idempotency_key="tenant_a:pay_123:refund:v1",
    )

    first = boundary.execute(caller, request)
    repeated = boundary.execute(caller, request)
    assert first == repeated
    print(first)
