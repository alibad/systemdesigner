"""Estimate the shot budget for measuring a Pauli expectation value.

This is a planning model, not a device simulator. It uses the independent-shot
normal approximation so the assumptions stay visible.
"""

from math import ceil, sqrt


def required_shots(expectation: float, half_width: float, z_score: float = 1.96) -> int:
    """Return shots needed for a two-sided confidence interval.

    A Pauli measurement is +1 or -1, so its variance is 1 - expectation**2.
    Correlated errors, drift, and mitigation overhead require a larger budget.
    """
    if not -1 <= expectation <= 1:
        raise ValueError("expectation must be between -1 and 1")
    if half_width <= 0:
        raise ValueError("half_width must be positive")

    variance = max(0.0, 1.0 - expectation**2)
    return ceil((z_score**2 * variance) / half_width**2)


target = 0.24
shots_per_expectation = required_shots(target, half_width=0.03)
trainable_parameters = 12
parameter_shift_circuits = 2 * trainable_parameters
shots_per_gradient_step = shots_per_expectation * parameter_shift_circuits

print(f"Shots per expectation: {shots_per_expectation:,}")
print(f"Circuit shots per gradient step: {shots_per_gradient_step:,}")
