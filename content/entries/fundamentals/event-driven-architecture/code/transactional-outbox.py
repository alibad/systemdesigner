#!/usr/bin/env python3
"""Demonstrate a transactional outbox and an idempotent consumer with SQLite."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone


SCHEMA = """
CREATE TABLE orders (
    order_id TEXT PRIMARY KEY,
    amount_cents INTEGER NOT NULL
);
CREATE TABLE outbox (
    event_id TEXT PRIMARY KEY,
    envelope_json TEXT NOT NULL,
    published_at TEXT
);
CREATE TABLE processed_events (
    consumer TEXT NOT NULL,
    event_id TEXT NOT NULL,
    PRIMARY KEY (consumer, event_id)
);
CREATE TABLE payments (
    order_id TEXT PRIMARY KEY,
    amount_cents INTEGER NOT NULL
);
"""


def event_envelope(order_id: str, amount_cents: int) -> dict[str, object]:
    return {
        "specversion": "1.0",
        "id": str(uuid.uuid4()),
        "source": "/services/orders",
        "type": "com.systemdesigner.order.created.v1",
        "subject": order_id,
        "time": datetime.now(timezone.utc).isoformat(),
        "datacontenttype": "application/json",
        "data": {"orderId": order_id, "amountCents": amount_cents},
    }


def create_order(connection: sqlite3.Connection, order_id: str, amount_cents: int) -> None:
    event = event_envelope(order_id, amount_cents)
    with connection:
        connection.execute("INSERT INTO orders VALUES (?, ?)", (order_id, amount_cents))
        connection.execute(
            "INSERT INTO outbox(event_id, envelope_json) VALUES (?, ?)",
            (event["id"], json.dumps(event, separators=(",", ":"))),
        )


def relay_one(connection: sqlite3.Connection) -> dict[str, object] | None:
    row = connection.execute(
        "SELECT event_id, envelope_json FROM outbox WHERE published_at IS NULL LIMIT 1"
    ).fetchone()
    if row is None:
        return None

    event_id, envelope_json = row
    # A real relay marks the row only after the broker acknowledges the send.
    with connection:
        connection.execute(
            "UPDATE outbox SET published_at = ? WHERE event_id = ?",
            (datetime.now(timezone.utc).isoformat(), event_id),
        )
    return json.loads(envelope_json)


def apply_payment(connection: sqlite3.Connection, event: dict[str, object]) -> bool:
    event_id = str(event["id"])
    data = event["data"]
    assert isinstance(data, dict)

    with connection:
        duplicate = connection.execute(
            "SELECT 1 FROM processed_events WHERE consumer = ? AND event_id = ?",
            ("payments", event_id),
        ).fetchone()
        if duplicate:
            return False

        connection.execute(
            "INSERT INTO payments VALUES (?, ?)",
            (data["orderId"], data["amountCents"]),
        )
        connection.execute(
            "INSERT INTO processed_events VALUES (?, ?)",
            ("payments", event_id),
        )
    return True


def main() -> None:
    connection = sqlite3.connect(":memory:")
    connection.executescript(SCHEMA)

    create_order(connection, "order-42", 1299)
    published = relay_one(connection)
    assert published is not None

    first_delivery = apply_payment(connection, published)
    repeated_delivery = apply_payment(connection, published)
    payment_count = connection.execute("SELECT COUNT(*) FROM payments").fetchone()[0]

    print(json.dumps(published, indent=2))
    print(f"first delivery applied: {first_delivery}")
    print(f"repeated delivery applied: {repeated_delivery}")
    print(f"payment rows: {payment_count}")
    assert (first_delivery, repeated_delivery, payment_count) == (True, False, 1)


if __name__ == "__main__":
    main()
