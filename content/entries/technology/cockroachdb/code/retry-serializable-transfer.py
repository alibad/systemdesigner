from __future__ import annotations

import random
import time
from uuid import UUID

import psycopg
from psycopg.errors import SerializationFailure


MAX_ATTEMPTS = 5


def transfer(
    conn: psycopg.Connection,
    *,
    transfer_id: UUID,
    from_account: UUID,
    to_account: UUID,
    amount_cents: int,
) -> None:
    for attempt in range(MAX_ATTEMPTS):
        try:
            with conn.transaction():
                existing = conn.execute(
                    "SELECT 1 FROM transfers WHERE transfer_id = %s",
                    (transfer_id,),
                ).fetchone()
                if existing:
                    return

                debited = conn.execute(
                    """
                    UPDATE accounts
                    SET balance_cents = balance_cents - %s
                    WHERE account_id = %s
                      AND balance_cents >= %s
                    RETURNING balance_cents
                    """,
                    (amount_cents, from_account, amount_cents),
                ).fetchone()
                if not debited:
                    raise ValueError("insufficient funds")

                conn.execute(
                    """
                    UPDATE accounts
                    SET balance_cents = balance_cents + %s
                    WHERE account_id = %s
                    """,
                    (amount_cents, to_account),
                )
                conn.execute(
                    """
                    INSERT INTO transfers (
                        transfer_id,
                        from_account,
                        to_account,
                        amount_cents
                    ) VALUES (%s, %s, %s, %s)
                    """,
                    (transfer_id, from_account, to_account, amount_cents),
                )
            return
        except SerializationFailure:
            if attempt == MAX_ATTEMPTS - 1:
                raise
            delay_seconds = min(0.5, 0.02 * (2**attempt))
            time.sleep(random.uniform(0, delay_seconds))

    raise RuntimeError("unreachable")
