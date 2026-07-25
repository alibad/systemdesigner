"""Idempotent external side-effect boundary for an at-least-once consumer.

The in-memory dictionaries stand in for two tables changed in one database
transaction: processed_events(event_id primary key) and orders(order_id primary key).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class OrderEvent:
    event_id: str
    order_id: str
    status: str


class OrderStore:
    def __init__(self) -> None:
        self.processed_events: set[str] = set()
        self.order_status: dict[str, str] = {}

    def apply_once(self, event: OrderEvent) -> str:
        # In production, the deduplication insert and business mutation must commit
        # in the same database transaction.
        if event.event_id in self.processed_events:
            return "replay: existing result preserved"

        self.processed_events.add(event.event_id)
        self.order_status[event.order_id] = event.status
        return "applied: business state and event receipt committed"


if __name__ == "__main__":
    store = OrderStore()
    delivery = OrderEvent(
        event_id="evt-order-104-paid",
        order_id="order-104",
        status="paid",
    )

    print(store.apply_once(delivery))
    print(store.apply_once(delivery))  # Simulates replay after an offset-commit failure.

    assert store.order_status == {"order-104": "paid"}
    assert store.processed_events == {"evt-order-104-paid"}
