"""Keep external side effects outside this retryable transaction function."""

from google.cloud import spanner


def transfer_funds(database, source_id, target_id, amount):
    def apply_transfer(transaction):
        rows = transaction.execute_sql(
            """
            SELECT Balance
            FROM Accounts
            WHERE AccountId = @source_id
            """,
            params={"source_id": source_id},
            param_types={"source_id": spanner.param_types.STRING},
        )
        source_balance = next(iter(rows))[0]
        if source_balance < amount:
            raise ValueError("insufficient funds")

        transaction.execute_update(
            """
            UPDATE Accounts
            SET Balance = Balance - @amount
            WHERE AccountId = @source_id
            """,
            params={"amount": amount, "source_id": source_id},
            param_types={
                "amount": spanner.param_types.NUMERIC,
                "source_id": spanner.param_types.STRING,
            },
        )
        transaction.execute_update(
            """
            UPDATE Accounts
            SET Balance = Balance + @amount
            WHERE AccountId = @target_id
            """,
            params={"amount": amount, "target_id": target_id},
            param_types={
                "amount": spanner.param_types.NUMERIC,
                "target_id": spanner.param_types.STRING,
            },
        )

    database.run_in_transaction(apply_transfer)
