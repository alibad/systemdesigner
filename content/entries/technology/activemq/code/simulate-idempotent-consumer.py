"""Model repeated broker delivery with a transactional SQLite inbox."""

import sqlite3


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE processed_message (
            event_id TEXT PRIMARY KEY,
            result TEXT NOT NULL
        );
        CREATE TABLE account_balance (
            account_id TEXT PRIMARY KEY,
            balance_cents INTEGER NOT NULL
        );
        INSERT INTO account_balance VALUES ('acct-17', 10000);
        """
    )


def apply_debit(
    connection: sqlite3.Connection,
    event_id: str,
    account_id: str,
    amount_cents: int,
) -> str:
    with connection:
        previous = connection.execute(
            "SELECT result FROM processed_message WHERE event_id = ?",
            (event_id,),
        ).fetchone()
        if previous:
            return str(previous[0])

        connection.execute(
            "UPDATE account_balance SET balance_cents = balance_cents - ? WHERE account_id = ?",
            (amount_cents, account_id),
        )
        result = f"debited:{amount_cents}"
        connection.execute(
            "INSERT INTO processed_message(event_id, result) VALUES (?, ?)",
            (event_id, result),
        )
        return result


if __name__ == "__main__":
    database = sqlite3.connect(":memory:")
    create_schema(database)

    first = apply_debit(database, "payment-884", "acct-17", 2_500)
    redelivery = apply_debit(database, "payment-884", "acct-17", 2_500)
    balance = database.execute(
        "SELECT balance_cents FROM account_balance WHERE account_id = 'acct-17'"
    ).fetchone()[0]

    assert first == redelivery == "debited:2500"
    assert balance == 7_500
    assert database.execute("SELECT COUNT(*) FROM processed_message").fetchone()[0] == 1
    print(f"first={first}, redelivery={redelivery}, balance_cents={balance}")
