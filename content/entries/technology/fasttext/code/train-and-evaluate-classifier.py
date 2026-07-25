"""Train, select, and evaluate a supervised fastText classifier."""

from pathlib import Path

import fasttext


TRAIN_FILE = Path("data/train.txt")
VALIDATION_FILE = Path("data/validation.txt")
TEST_FILE = Path("data/test.txt")


def print_metrics(name: str, results: tuple[int, float, float]) -> None:
    examples, precision_at_one, recall_at_one = results
    print(
        f"{name}: examples={examples} "
        f"P@1={precision_at_one:.3f} R@1={recall_at_one:.3f}"
    )


model = fasttext.train_supervised(
    input=str(TRAIN_FILE),
    autotuneValidationFile=str(VALIDATION_FILE),
    autotuneDuration=600,
    autotuneMetric="f1",
    verbose=2,
)

# The test set was not used for hyperparameter selection.
print_metrics("full model", model.test(str(TEST_FILE), k=1))
model.save_model("artifacts/router.bin")

# Quantization is a separate candidate and needs its own quality measurement.
model.quantize(input=str(TRAIN_FILE), retrain=True, qnorm=True)
print_metrics("quantized model", model.test(str(TEST_FILE), k=1))
model.save_model("artifacts/router.ftz")

labels, probabilities = model.predict(
    "refund has not reached my card",
    k=2,
)
print(list(zip(labels, probabilities, strict=True)))
