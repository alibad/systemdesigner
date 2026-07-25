"""Estimate autoregressive Transformer KV-cache capacity."""

from dataclasses import dataclass


GIB = 1024**3


@dataclass(frozen=True)
class DecoderShape:
    layers: int
    query_heads: int
    head_dimension: int
    bytes_per_element: int


def kv_cache_bytes(
    shape: DecoderShape,
    cached_tokens: int,
    concurrent_sequences: int,
    kv_heads: int,
) -> int:
    if not 1 <= kv_heads <= shape.query_heads:
        raise ValueError("KV heads must be between one and the query-head count")
    if cached_tokens < 1 or concurrent_sequences < 1:
        raise ValueError("tokens and concurrency must be positive")

    return (
        2
        * shape.layers
        * concurrent_sequences
        * cached_tokens
        * kv_heads
        * shape.head_dimension
        * shape.bytes_per_element
    )


if __name__ == "__main__":
    model = DecoderShape(
        layers=32,
        query_heads=32,
        head_dimension=128,
        bytes_per_element=2,
    )
    strategies = {"MHA": 32, "GQA": 8, "MQA": 1}

    for name, kv_head_count in strategies.items():
        cache = kv_cache_bytes(
            model,
            cached_tokens=8192,
            concurrent_sequences=4,
            kv_heads=kv_head_count,
        )
        print(f"{name}: {cache / GIB:.2f} GiB for four active sequences")

    assert kv_cache_bytes(model, 8192, 1, 8) == GIB
