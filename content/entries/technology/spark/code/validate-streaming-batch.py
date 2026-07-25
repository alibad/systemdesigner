from dataclasses import dataclass
from typing import Protocol

from pyspark.sql import DataFrame


class CommitLedger(Protocol):
    def has_committed(self, query_id: str, batch_id: int) -> bool: ...

    def record_commit(
        self,
        query_id: str,
        batch_id: int,
        row_count: int,
    ) -> None: ...


class TransactionalSink(Protocol):
    def replace_batch(
        self,
        query_id: str,
        batch_id: int,
        rows: DataFrame,
    ) -> None: ...


@dataclass(frozen=True)
class StreamingBatchWriter:
    query_id: str
    ledger: CommitLedger
    sink: TransactionalSink

    def __call__(self, rows: DataFrame, batch_id: int) -> None:
        """Commit a replayed micro-batch under the same stable identity."""
        if self.ledger.has_committed(self.query_id, batch_id):
            return

        validated = rows.where(
            "account_id IS NOT NULL AND event_time IS NOT NULL"
        )
        row_count = validated.count()

        # replace_batch must atomically overwrite or upsert this query/batch key.
        self.sink.replace_batch(
            self.query_id,
            batch_id,
            validated,
        )
        self.ledger.record_commit(
            self.query_id,
            batch_id,
            row_count,
        )
