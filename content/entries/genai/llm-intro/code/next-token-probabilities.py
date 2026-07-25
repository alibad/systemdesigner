import math


def probabilities(logits: dict[str, float], temperature: float) -> dict[str, float]:
    """Convert model scores into a normalized next-token distribution."""
    if temperature <= 0:
        raise ValueError("temperature must be greater than zero")

    scaled = {token: score / temperature for token, score in logits.items()}
    maximum = max(scaled.values())
    weights = {token: math.exp(score - maximum) for token, score in scaled.items()}
    total = sum(weights.values())
    return {token: weight / total for token, weight in weights.items()}


if __name__ == "__main__":
    candidate_logits = {"Paris": 4.4, "Lyon": -0.4, "I cannot verify": 0.7, "Rome": -1.0}
    distribution = probabilities(candidate_logits, temperature=0.7)

    for token, probability in sorted(distribution.items(), key=lambda item: item[1], reverse=True):
        print(f"{token:16} {probability:6.2%}")

    assert abs(sum(distribution.values()) - 1.0) < 1e-9
    assert max(distribution, key=distribution.get) == "Paris"
    print("Probability ranks continuations; it does not independently verify the claim.")
