"""Apply versioned vector mutations without retry duplication or resurrection."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Operation(str, Enum):
    UPSERT = "upsert"
    DELETE = "delete"


@dataclass(frozen=True)
class Mutation:
    source_id: str
    chunk_id: str
    source_version: int
    operation: Operation
    vector: tuple[float, ...] | None = None

    @property
    def point_id(self) -> str:
        return f"{self.source_id}:{self.chunk_id}"


@dataclass
class StoredPoint:
    source_version: int
    deleted: bool
    vector: tuple[float, ...] | None


class VersionedVectorIndex:
    def __init__(self) -> None:
        self.points: dict[str, StoredPoint] = {}
        self.checkpoint = 0

    def apply(self, sequence: int, mutation: Mutation) -> str:
        current = self.points.get(mutation.point_id)
        if current and current.source_version >= mutation.source_version:
            self.checkpoint = max(self.checkpoint, sequence)
            return "ignored-stale-or-retried"

        self.points[mutation.point_id] = StoredPoint(
            source_version=mutation.source_version,
            deleted=mutation.operation is Operation.DELETE,
            vector=mutation.vector if mutation.operation is Operation.UPSERT else None,
        )
        self.checkpoint = max(self.checkpoint, sequence)
        return "applied"

    def visible(self, point_id: str) -> bool:
        point = self.points.get(point_id)
        return bool(point and not point.deleted)


if __name__ == "__main__":
    index = VersionedVectorIndex()
    latest = Mutation("policy", "chunk-7", 3, Operation.UPSERT, (0.2, 0.8))
    delayed_old_write = Mutation("policy", "chunk-7", 2, Operation.UPSERT, (0.9, 0.1))
    deletion = Mutation("policy", "chunk-7", 4, Operation.DELETE)

    assert index.apply(101, latest) == "applied"
    assert index.apply(102, latest) == "ignored-stale-or-retried"
    assert index.apply(103, delayed_old_write) == "ignored-stale-or-retried"
    assert index.apply(104, deletion) == "applied"
    assert index.apply(105, latest) == "ignored-stale-or-retried"
    assert not index.visible("policy:chunk-7")
    print({"checkpoint": index.checkpoint, "visible": False, "version": 4})
