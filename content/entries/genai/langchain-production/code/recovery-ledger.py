"""Reconcile an ambiguous side effect before resuming a workflow."""

from dataclasses import dataclass, field


@dataclass
class PaymentService:
    charges: dict[str, str] = field(default_factory=dict)

    def charge(self, operation_key: str) -> str:
        """A stable key makes repeated delivery return the original effect."""
        if operation_key not in self.charges:
            self.charges[operation_key] = f"charge-{len(self.charges) + 1}"
        return self.charges[operation_key]

    def find_by_operation(self, operation_key: str) -> str | None:
        return self.charges.get(operation_key)


@dataclass
class Checkpoint:
    operation_key: str
    status: str = "intent-recorded"
    effect_id: str | None = None


def resume_after_timeout(checkpoint: Checkpoint, payments: PaymentService) -> Checkpoint:
    """Read authoritative state before deciding whether another write is needed."""
    existing_effect = payments.find_by_operation(checkpoint.operation_key)
    if existing_effect is not None:
        checkpoint.status = "effect-reconciled"
        checkpoint.effect_id = existing_effect
        return checkpoint

    checkpoint.effect_id = payments.charge(checkpoint.operation_key)
    checkpoint.status = "effect-committed"
    return checkpoint


if __name__ == "__main__":
    service = PaymentService()
    state = Checkpoint(operation_key="refund-order-1842")

    # The service commits, but the worker loses the response before checkpointing it.
    service.charge(state.operation_key)
    recovered = resume_after_timeout(state, service)

    print({"status": recovered.status, "effect_id": recovered.effect_id})
    print({"business_effects": len(service.charges)})
