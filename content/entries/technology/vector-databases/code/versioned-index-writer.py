"""Apply idempotent vector-index mutations with versions and tombstones."""

from dataclasses import dataclass
from typing import Literal


Operation = Literal["upsert", "delete"]


@dataclass(frozen=True)
class Mutation:
    mutation_id: str
    record_id: str
    source_version: int
    embedding_version: str
    operation: Operation
    vector: tuple[float, ...] | None = None


@dataclass
class IndexedRecord:
    source_version: int
    embedding_version: str
    vector: tuple[float, ...] | None
    deleted: bool


class VersionedIndexWriter:
    def __init__(self, expected_embedding_version: str) -> None:
        self.expected_embedding_version = expected_embedding_version
        self.records: dict[str, IndexedRecord] = {}
        self.applied_mutations: set[str] = set()
        self.checkpoint = 0

    def apply(self, offset: int, mutation: Mutation) -> str:
        if mutation.mutation_id in self.applied_mutations:
            self.checkpoint = max(self.checkpoint, offset)
            return "duplicate ignored"
        if mutation.embedding_version != self.expected_embedding_version:
            return "wrong embedding generation rejected"

        current = self.records.get(mutation.record_id)
        if current and mutation.source_version <= current.source_version:
            self.applied_mutations.add(mutation.mutation_id)
            self.checkpoint = max(self.checkpoint, offset)
            return "stale version ignored"

        if mutation.operation == "delete":
            next_record = IndexedRecord(
                source_version=mutation.source_version,
                embedding_version=mutation.embedding_version,
                vector=None,
                deleted=True,
            )
        else:
            if mutation.vector is None:
                raise ValueError("upsert requires a vector")
            next_record = IndexedRecord(
                source_version=mutation.source_version,
                embedding_version=mutation.embedding_version,
                vector=mutation.vector,
                deleted=False,
            )

        self.records[mutation.record_id] = next_record
        self.applied_mutations.add(mutation.mutation_id)
        self.checkpoint = max(self.checkpoint, offset)
        return "mutation applied"


if __name__ == "__main__":
    writer = VersionedIndexWriter(expected_embedding_version="embed-v2")
    stream = [
        (101, Mutation("m-1", "doc-7", 4, "embed-v2", "upsert", (0.2, 0.8))),
        (102, Mutation("m-1", "doc-7", 4, "embed-v2", "upsert", (0.2, 0.8))),
        (103, Mutation("m-2", "doc-7", 5, "embed-v2", "delete")),
        (104, Mutation("m-3", "doc-7", 4, "embed-v2", "upsert", (0.9, 0.1))),
    ]

    for stream_offset, event in stream:
        print(stream_offset, writer.apply(stream_offset, event))

    print("checkpoint:", writer.checkpoint)
    print("doc-7 deleted:", writer.records["doc-7"].deleted)
