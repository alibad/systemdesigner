from dataclasses import dataclass


@dataclass(frozen=True)
class Impression:
    reward: float
    logging_probability: float
    target_probability: float


def inverse_propensity_value(impressions: list[Impression], weight_cap: float = 10.0) -> float:
    if not impressions:
        raise ValueError("at least one impression is required")

    weighted_reward = 0.0
    total_weight = 0.0
    for impression in impressions:
        if impression.logging_probability <= 0:
            raise ValueError("logging probability must be positive")
        weight = min(weight_cap, impression.target_probability / impression.logging_probability)
        weighted_reward += impression.reward * weight
        total_weight += weight
    return weighted_reward / total_weight


if __name__ == "__main__":
    sample = [
        Impression(reward=1.0, logging_probability=0.40, target_probability=0.30),
        Impression(reward=0.0, logging_probability=0.20, target_probability=0.35),
        Impression(reward=1.0, logging_probability=0.10, target_probability=0.20),
    ]
    estimate = inverse_propensity_value(sample)
    assert 0.60 < estimate < 0.65
    print(f"bounded counterfactual value: {estimate:.3f}")
