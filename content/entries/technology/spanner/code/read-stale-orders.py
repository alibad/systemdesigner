"""Read a consistent Spanner snapshot exactly 15 seconds in the past."""

from datetime import timedelta

from google.cloud import spanner


def read_stale_orders(database, customer_id):
    staleness = timedelta(seconds=15)

    with database.snapshot(exact_staleness=staleness) as snapshot:
        rows = snapshot.execute_sql(
            """
            SELECT OrderId, CreatedAt, Status
            FROM Orders
            WHERE CustomerId = @customer_id
            ORDER BY CreatedAt DESC
            LIMIT 100
            """,
            params={"customer_id": customer_id},
            param_types={"customer_id": spanner.param_types.STRING},
        )
        return list(rows)
