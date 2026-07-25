"""Estimate decoder KV-cache capacity without framework dependencies."""

from dataclasses import dataclass


GIB = 1024**3


@dataclass(frozen=True)
class DecoderShape:
    layers: int
    query_heads: int
    head_dimension: int
    bytes_per_element: int


@dataclass(frozen=True)
class AttentionShape:
    name: str
    kv_heads: int


def kv_bytes_per_sequence(
    model: DecoderShape,
    attention: AttentionShape,
    cached_tokens: int,
) -> int:
    if cached_tokens <= 0:
        raise ValueError("cached_tokens must be positive")
    if not 1 <= attention.kv_heads <= model.query_heads:
        raise ValueError("kv_heads must be between one and query_heads")
    if model.query_heads % attention.kv_heads != 0:
        raise ValueError("query_heads must divide evenly across KV heads")

    return (
        2
        * model.layers
        * cached_tokens
        * attention.kv_heads
        * model.head_dimension
        * model.bytes_per_element
    )


def max_sequences(cache_budget_gib: int, bytes_per_sequence: int) -> int:
    if cache_budget_gib <= 0 or bytes_per_sequence <= 0:
        raise ValueError("cache budget and sequence bytes must be positive")
    return cache_budget_gib * GIB // bytes_per_sequence


def main() -> None:
    model = DecoderShape(
        layers=32,
        query_heads=32,
        head_dimension=128,
        bytes_per_element=2,
    )
    attention_shapes = (
        AttentionShape("MHA", kv_heads=32),
        AttentionShape("GQA", kv_heads=8),
        AttentionShape("MQA", kv_heads=1),
    )
    cached_tokens = 8192
    cache_budget_gib = 24

    print(f"Context: {cached_tokens:,} tokens; cache budget: {cache_budget_gib} GiB")
    for attention in attention_shapes:
        sequence_bytes = kv_bytes_per_sequence(model, attention, cached_tokens)
        capacity = max_sequences(cache_budget_gib, sequence_bytes)
        print(
            f"{attention.name}: {sequence_bytes / GIB:.3f} GiB/sequence; "
            f"at most {capacity} whole sequences before runtime overhead"
        )

    assert kv_bytes_per_sequence(model, attention_shapes[1], cached_tokens) == GIB
    assert max_sequences(cache_budget_gib, GIB) == 24


if __name__ == "__main__":
    main()
