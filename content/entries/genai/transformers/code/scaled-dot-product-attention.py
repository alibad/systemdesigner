"""Small, dependency-free scaled dot-product attention model."""

from math import exp, sqrt
from typing import Sequence


Vector = Sequence[float]


def dot(left: Vector, right: Vector) -> float:
    if len(left) != len(right):
        raise ValueError("query and key dimensions must match")
    return sum(a * b for a, b in zip(left, right))


def softmax(scores: Sequence[float]) -> list[float]:
    if not scores:
        raise ValueError("at least one permitted key is required")
    maximum = max(scores)
    numerators = [exp(score - maximum) for score in scores]
    denominator = sum(numerators)
    return [value / denominator for value in numerators]


def scaled_dot_product_attention(
    query: Vector,
    keys: Sequence[Vector],
    values: Sequence[Vector],
    allowed: Sequence[bool],
) -> tuple[list[float], list[float]]:
    if not (len(keys) == len(values) == len(allowed)):
        raise ValueError("keys, values, and mask must have equal lengths")
    if not keys or not any(allowed):
        raise ValueError("attention cannot use an empty or fully masked key set")
    if any(len(key) != len(query) for key in keys):
        raise ValueError("all keys must match the query dimension")
    value_width = len(values[0])
    if any(len(value) != value_width for value in values):
        raise ValueError("all values must have the same dimension")

    scale = sqrt(len(query))
    permitted_scores = [
        dot(query, key) / scale
        for key, is_allowed in zip(keys, allowed)
        if is_allowed
    ]
    permitted_weights = iter(softmax(permitted_scores))
    weights = [next(permitted_weights) if is_allowed else 0.0 for is_allowed in allowed]
    output = [
        sum(weight * value[column] for weight, value in zip(weights, values))
        for column in range(value_width)
    ]
    return weights, output


if __name__ == "__main__":
    token_query = [1.0, 0.0]
    token_keys = [[1.0, 0.0], [0.7, 0.3], [0.0, 1.0]]
    token_values = [[10.0, 0.0], [4.0, 6.0], [0.0, 10.0]]
    causal_mask = [True, True, False]

    attention_weights, contextual_value = scaled_dot_product_attention(
        token_query,
        token_keys,
        token_values,
        causal_mask,
    )

    assert abs(sum(attention_weights) - 1.0) < 1e-9
    assert attention_weights[-1] == 0.0
    print("weights:", [round(weight, 4) for weight in attention_weights])
    print("context:", [round(value, 4) for value in contextual_value])
