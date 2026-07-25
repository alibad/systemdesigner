import math


def softmax(logits: dict[str, float]) -> dict[str, float]:
    maximum = max(logits.values())
    weights = {token: math.exp(score - maximum) for token, score in logits.items()}
    total = sum(weights.values())
    return {token: weight / total for token, weight in weights.items()}


def nucleus_candidates(probabilities: dict[str, float], top_p: float) -> dict[str, float]:
    """Keep the smallest ranked set whose cumulative mass reaches top_p."""
    kept: dict[str, float] = {}
    cumulative = 0.0
    for token, probability in sorted(probabilities.items(), key=lambda item: item[1], reverse=True):
        kept[token] = probability
        cumulative += probability
        if cumulative >= top_p:
            break

    kept_total = sum(kept.values())
    return {token: probability / kept_total for token, probability in kept.items()}


def choose_next_token(
    raw_logits: dict[str, float], temperature: float, top_p: float, greedy: bool
) -> str:
    scaled_logits = {token: logit / temperature for token, logit in raw_logits.items()}
    candidates = nucleus_candidates(softmax(scaled_logits), top_p)
    if greedy:
        return max(candidates, key=candidates.get)

    # Use a seeded RNG in a real experiment so a sampled trace can be reproduced.
    # random.choices(tuple(candidates), weights=tuple(candidates.values()), k=1)[0]
    return "sample-from-candidates"


# Evidence belongs in raw_logits only while the evidence text is retained in context.
# Decoding changes which supported token is selected; it does not verify the evidence.
