from dataclasses import dataclass


@dataclass(frozen=True)
class EvaluationSlice:
    name: str
    correct: int
    total: int

    @property
    def accuracy(self) -> float:
        return self.correct / self.total


def percentage(value: float) -> str:
    return f"{value:.1%}"


training = EvaluationSlice("training", correct=950, total=1_000)
validation = EvaluationSlice("validation", correct=790, total=1_000)
new_region = EvaluationSlice("new-region holdout", correct=640, total=1_000)

for evaluation_slice in (training, validation, new_region):
    print(f"{evaluation_slice.name:20} {percentage(evaluation_slice.accuracy)}")

generalization_gap = training.accuracy - validation.accuracy
print(f"generalization gap   {percentage(generalization_gap)}")

if generalization_gap > 0.10:
    print("Investigate overfitting before adding model complexity.")
if new_region.accuracy < validation.accuracy - 0.10:
    print("Aggregate validation hides a distribution-shift risk.")
