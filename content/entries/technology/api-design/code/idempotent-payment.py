"""A dependency-free model of caller-scoped API idempotency."""

from dataclasses import dataclass
from hashlib import sha256
import json


@dataclass(frozen=True)
class Payment:
    payment_id: str
    amount_minor: int
    currency: str


class IdempotencyConflict(ValueError):
    pass


class PaymentService:
    def __init__(self) -> None:
        self._replays: dict[tuple[str, str], tuple[str, Payment]] = {}

    @staticmethod
    def _fingerprint(body: dict[str, object]) -> str:
        normalized = json.dumps(body, sort_keys=True, separators=(",", ":"))
        return sha256(normalized.encode("utf-8")).hexdigest()

    def create_payment(
        self,
        *,
        caller_id: str,
        idempotency_key: str,
        body: dict[str, object],
    ) -> tuple[Payment, bool]:
        replay_key = (caller_id, idempotency_key)
        fingerprint = self._fingerprint(body)
        existing = self._replays.get(replay_key)

        if existing:
            stored_fingerprint, payment = existing
            if stored_fingerprint != fingerprint:
                raise IdempotencyConflict("key reused with a different request body")
            return payment, True

        payment = Payment(
            payment_id=f"pay_{len(self._replays) + 1:04d}",
            amount_minor=int(body["amount_minor"]),
            currency=str(body["currency"]),
        )
        # A real service commits this record and the payment in one atomic boundary.
        self._replays[replay_key] = (fingerprint, payment)
        return payment, False


service = PaymentService()
request = {"amount_minor": 4200, "currency": "USD"}

first, replayed = service.create_payment(
    caller_id="merchant_7",
    idempotency_key="checkout_184",
    body=request,
)
second, second_replayed = service.create_payment(
    caller_id="merchant_7",
    idempotency_key="checkout_184",
    body=request,
)

assert first == second
assert replayed is False and second_replayed is True
print({"payment_id": second.payment_id, "replayed": second_replayed})
