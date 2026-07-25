from math import exp, log, pi


CLASS_MODELS = {
    "healthy": {
        "prior": 0.82,
        "temperature": (48.0, 8.0),
        "vibration": (2.3, 0.9),
    },
    "fault": {
        "prior": 0.18,
        "temperature": (73.0, 11.0),
        "vibration": (6.4, 1.7),
    },
}


def gaussian_log_likelihood(value: float, mean: float, standard_deviation: float) -> float:
    variance = standard_deviation**2
    return -0.5 * log(2 * pi * variance) - (value - mean) ** 2 / (2 * variance)


def posterior(observed: dict[str, float]) -> dict[str, float]:
    """Marginalize absent Naive Bayes features by omitting their likelihood terms."""
    log_scores = {}
    for class_name, model in CLASS_MODELS.items():
        score = log(model["prior"])
        for feature, value in observed.items():
            mean, standard_deviation = model[feature]
            score += gaussian_log_likelihood(value, mean, standard_deviation)
        log_scores[class_name] = score

    maximum = max(log_scores.values())
    unnormalized = {name: exp(score - maximum) for name, score in log_scores.items()}
    total = sum(unnormalized.values())
    return {name: value / total for name, value in unnormalized.items()}


complete = posterior({"temperature": 74.0, "vibration": 7.0})
temperature_only = posterior({"temperature": 74.0})
no_current_evidence = posterior({})

print(f"Complete evidence: {complete}")
print(f"Temperature only: {temperature_only}")
print(f"No current evidence: {no_current_evidence}")

assert abs(sum(complete.values()) - 1.0) < 1e-9
assert complete["fault"] > temperature_only["fault"]
assert abs(no_current_evidence["healthy"] - 0.82) < 1e-9
assert abs(no_current_evidence["fault"] - 0.18) < 1e-9
