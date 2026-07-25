#!/usr/bin/env python3
"""Demonstrate an atomic deduplication boundary for a redelivered event."""

import sqlite3


def apply_credit(connection: sqlite3.Connection, event_id: str, account_id: str, cents: int) -> str:
    with connection:
        inserted = connection.execute(
            "INSERT OR IGNORE INTO processed_events(event_id) VALUES (?)",
            (event_id,),
        ).rowcount
        if inserted == 0:
            return "duplicate"
        connection.execute(
            "UPDATE accounts SET balance_cents = balance_cents + ? WHERE account_id = ?",
            (cents, account_id),
        )
    return "applied"


def main() -> None:
    database = sqlite3.connect(":memory:")
    database.executescript(
        """
        CREATE TABLE processed_events (event_id TEXT PRIMARY KEY);
        CREATE TABLE accounts (account_id TEXT PRIMARY KEY, balance_cents INTEGER NOT NULL);
        INSERT INTO accounts VALUES ('acct-7', 10000);
        """
    )

    for delivery in (1, 2):
        outcome = apply_credit(database, "event-42", "acct-7", 2500)
        print(f"delivery {delivery}: {outcome}")

    balance = database.execute(
        "SELECT balance_cents FROM accounts WHERE account_id = 'acct-7'"
    ).fetchone()[0]
    assert balance == 12500
    print(f"final balance: {balance} cents")


if __name__ == "__main__":
    main()
