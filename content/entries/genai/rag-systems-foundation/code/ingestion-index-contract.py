"""Executable example of a versioned RAG ingestion and indexing contract."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import math
import re


TOKEN_RE = re.compile(r"[A-Za-z0-9_-]+")


@dataclass(frozen=True)
class IndexContract:
    embedding_model: str
    dimensions: int
    normalize_vectors: bool
    chunker_version: str
    distance_metric: str
    source_snapshot: str

    @property
    def fingerprint(self) -> str:
        payload = json.dumps(asdict(self), sort_keys=True).encode("ascii")
        return hashlib.sha256(payload).hexdigest()[:12]


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    document_id: str
    revision: int
    ordinal: int
    text: str
    source_uri: str
    tenant_id: str


@dataclass(frozen=True)
class IndexRecord:
    chunk: Chunk
    vector: tuple[float, ...]
    contract_fingerprint: str


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


def chunk_document(
    *,
    document_id: str,
    revision: int,
    text: str,
    source_uri: str,
    tenant_id: str,
    chunk_tokens: int,
    overlap_tokens: int,
) -> list[Chunk]:
    """Split on word tokens while preserving stable provenance metadata."""
    if chunk_tokens <= 0 or not 0 <= overlap_tokens < chunk_tokens:
        raise ValueError("overlap_tokens must be smaller than chunk_tokens")

    words = text.split()
    stride = chunk_tokens - overlap_tokens
    chunks: list[Chunk] = []

    for ordinal, start in enumerate(range(0, len(words), stride)):
        body = " ".join(words[start : start + chunk_tokens])
        if not body:
            break
        identity = f"{document_id}:{revision}:{ordinal}"
        chunks.append(
            Chunk(
                chunk_id=hashlib.sha256(identity.encode("ascii")).hexdigest()[:16],
                document_id=document_id,
                revision=revision,
                ordinal=ordinal,
                text=body,
                source_uri=source_uri,
                tenant_id=tenant_id,
            )
        )
        if start + chunk_tokens >= len(words):
            break

    return chunks


def deterministic_embedding(text: str, dimensions: int) -> tuple[float, ...]:
    """Create a local test vector; production uses the contract's real model."""
    vector = [0.0] * dimensions
    for token in tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        bucket = int.from_bytes(digest[:2], "big") % dimensions
        vector[bucket] += 1.0 if digest[2] % 2 == 0 else -1.0

    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return tuple(value / norm for value in vector)


class InMemoryIndex:
    def __init__(self, contract: IndexContract) -> None:
        self.contract = contract
        self.records: dict[str, IndexRecord] = {}

    def upsert(self, chunk: Chunk, vector: tuple[float, ...]) -> None:
        if len(vector) != self.contract.dimensions:
            raise ValueError("embedding dimensions do not match the index contract")
        self.records[chunk.chunk_id] = IndexRecord(
            chunk=chunk,
            vector=vector,
            contract_fingerprint=self.contract.fingerprint,
        )

    def delete_document_before_revision(self, document_id: str, revision: int) -> int:
        stale_ids = [
            record_id
            for record_id, record in self.records.items()
            if record.chunk.document_id == document_id and record.chunk.revision < revision
        ]
        for record_id in stale_ids:
            del self.records[record_id]
        return len(stale_ids)


def main() -> None:
    contract = IndexContract(
        embedding_model="example-embed-v3",
        dimensions=8,
        normalize_vectors=True,
        chunker_version="heading-aware-v2",
        distance_metric="cosine",
        source_snapshot="support-kb-2026-07-19",
    )
    text = (
        "Refund requests require an order identifier. Approved refunds return to "
        "the original payment method. Enterprise exceptions require manual review. "
        "The review record must include the policy revision and approving operator."
    )
    chunks = chunk_document(
        document_id="refund-policy",
        revision=7,
        text=text,
        source_uri="kb://policies/refunds",
        tenant_id="tenant-a",
        chunk_tokens=12,
        overlap_tokens=3,
    )

    index = InMemoryIndex(contract)
    for chunk in chunks:
        index.upsert(chunk, deterministic_embedding(chunk.text, contract.dimensions))

    first_count = len(index.records)
    for chunk in chunks:
        index.upsert(chunk, deterministic_embedding(chunk.text, contract.dimensions))
    assert len(index.records) == first_count, "retrying an upsert must be idempotent"
    assert all(
        record.contract_fingerprint == contract.fingerprint
        and len(record.vector) == contract.dimensions
        and record.chunk.source_uri
        for record in index.records.values()
    )

    deleted = index.delete_document_before_revision("refund-policy", revision=8)
    assert deleted == first_count and not index.records
    print(
        f"contract={contract.fingerprint} chunks={first_count} "
        f"idempotent=yes tombstoned={deleted}"
    )


if __name__ == "__main__":
    main()
