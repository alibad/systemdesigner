from dataclasses import dataclass


@dataclass(frozen=True)
class Belief:
    blocked_probability: float


TRANSITIONS = {
    "advance": {"blocked_if_blocked": 0.92, "blocked_if_open": 0.18},
    "inspect": {"blocked_if_blocked": 0.70, "blocked_if_open": 0.08},
    "wait": {"blocked_if_blocked": 0.82, "blocked_if_open": 0.12},
}


def predict_after_action(belief: Belief, action: str) -> Belief:
    transition = TRANSITIONS[action]
    prior = belief.blocked_probability
    predicted = (
        prior * transition["blocked_if_blocked"]
        + (1.0 - prior) * transition["blocked_if_open"]
    )
    return Belief(predicted)


def correct_with_observation(
    belief: Belief,
    observed_blockage: bool,
    sensor_accuracy: float,
) -> Belief:
    prior = belief.blocked_probability
    likelihood_if_blocked = sensor_accuracy if observed_blockage else 1.0 - sensor_accuracy
    likelihood_if_open = 1.0 - sensor_accuracy if observed_blockage else sensor_accuracy
    evidence = likelihood_if_blocked * prior + likelihood_if_open * (1.0 - prior)

    if evidence == 0:
        return belief

    posterior = likelihood_if_blocked * prior / evidence
    return Belief(posterior)


belief = Belief(blocked_probability=0.35)
belief = predict_after_action(belief, "inspect")
belief = correct_with_observation(belief, observed_blockage=True, sensor_accuracy=0.82)

print(f"posterior blockage probability: {belief.blocked_probability:.1%}")
print("decision: stop and replan" if belief.blocked_probability >= 0.55 else "decision: proceed")
