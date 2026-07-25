"""A minimal stateful transform that is fitted on training data only.

Run with: python fit-transform-contract.py
"""

from dataclasses import dataclass
from math import sqrt


@dataclass(frozen=True)
class ZScoreTransform:
    mean: float
    standard_deviation: float

    @classmethod
    def fit(cls, training_values: list[float]) -> "ZScoreTransform":
        if not training_values:
            raise ValueError("training_values must not be empty")

        mean = sum(training_values) / len(training_values)
        variance = sum((value - mean) ** 2 for value in training_values) / len(
            training_values
        )
        standard_deviation = sqrt(variance)
        if standard_deviation == 0:
            raise ValueError("cannot scale a constant feature")
        return cls(mean=mean, standard_deviation=standard_deviation)

    def transform(self, values: list[float]) -> list[float]:
        return [
            (value - self.mean) / self.standard_deviation for value in values
        ]


training_amounts = [12.0, 18.0, 25.0, 31.0]
validation_amounts = [15.0, 80.0]

# The validation values never influence learned transform state.
transform = ZScoreTransform.fit(training_amounts)
print("train:", [round(value, 2) for value in transform.transform(training_amounts)])
print("validation:", [round(value, 2) for value in transform.transform(validation_amounts)])
