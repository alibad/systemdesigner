import sqlite3


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE processed_operations (
            operation_id TEXT PRIMARY KEY,
            result TEXT NOT NULL
        );

        CREATE TABLE account_totals (
            account_id TEXT PRIMARY KEY,
            captured_cents INTEGER NOT NULL
        );

        INSERT INTO account_totals(account_id, captured_cents)
        VALUES ('account-42', 0);
        """
    )


def capture_payment(
    connection: sqlite3.Connection,
    operation_id: str,
    account_id: str,
    amount_cents: int,
) -> str:
    with connection:
        inserted = connection.execute(
            """
            INSERT OR IGNORE INTO processed_operations(operation_id, result)
            VALUES (?, 'captured')
            """,
            (operation_id,),
        ).rowcount

        if inserted == 0:
            return "duplicate delivery: returned the first result"

        connection.execute(
            """
            UPDATE account_totals
            SET captured_cents = captured_cents + ?
            WHERE account_id = ?
            """,
            (amount_cents, account_id),
        )
        return "captured"


if __name__ == "__main__":
    database = sqlite3.connect(":memory:")
    create_schema(database)

    first = capture_payment(database, "payment-9001", "account-42", 2500)
    retry = capture_payment(database, "payment-9001", "account-42", 2500)
    total = database.execute(
        "SELECT captured_cents FROM account_totals WHERE account_id = 'account-42'"
    ).fetchone()[0]

    assert first == "captured"
    assert retry.startswith("duplicate delivery")
    assert total == 2500

    print(first)
    print(retry)
    print(f"durable account effect: {total} cents")
