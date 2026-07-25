"""Define and verify a TensorFlow layer/model contract.

The --simulate path checks the same rank, width, and dtype invariants without
requiring TensorFlow.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any


FEATURE_COUNT = 32
OUTPUT_NAME = "risk_score"


@dataclass(frozen=True)
class TensorContract:
    rank: int
    feature_width: int
    dtype: str

    def accepts(self, shape: tuple[int | None, ...], dtype: str) -> bool:
        return len(shape) == self.rank and shape[-1] == self.feature_width and dtype == self.dtype


def run_simulation() -> None:
    contract = TensorContract(rank=2, feature_width=FEATURE_COUNT, dtype="float32")
    cases = {
        "valid_dynamic_batch": contract.accepts((None, FEATURE_COUNT), "float32"),
        "wrong_width": contract.accepts((None, 16), "float32"),
        "wrong_dtype": contract.accepts((None, FEATURE_COUNT), "float64"),
        "wrong_rank": contract.accepts((None, 4, 8), "float32"),
    }
    assert cases == {
        "valid_dynamic_batch": True,
        "wrong_width": False,
        "wrong_dtype": False,
        "wrong_rank": False,
    }
    print(json.dumps({"contract": contract.__dict__, "cases": cases}, indent=2, sort_keys=True))


def load_tensorflow() -> Any:
    try:
        import tensorflow as tf  # type: ignore[import-not-found]
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "TensorFlow is not installed. Re-run with --simulate for the dependency-light check."
        ) from exc
    return tf


def run_tensorflow() -> None:
    tf = load_tensorflow()

    @tf.keras.utils.register_keras_serializable(package="SystemDesigner")
    class ContractProjection(tf.keras.layers.Layer):
        def __init__(self, units: int, dropout_rate: float = 0.0, **kwargs: Any) -> None:
            super().__init__(**kwargs)
            self.units = units
            self.dropout_rate = dropout_rate
            self.projection = tf.keras.layers.Dense(units, activation="relu")
            self.dropout = tf.keras.layers.Dropout(dropout_rate)

        def call(self, inputs: Any, training: bool = False) -> Any:
            projected = self.projection(inputs)
            return self.dropout(projected, training=training)

        def get_config(self) -> dict[str, Any]:
            return {
                **super().get_config(),
                "units": self.units,
                "dropout_rate": self.dropout_rate,
            }

    features = tf.keras.Input(
        shape=(FEATURE_COUNT,), dtype=tf.float32, name="features"
    )
    hidden = ContractProjection(16, dropout_rate=0.1, name="projection")(features)
    score = tf.keras.layers.Dense(1, activation="sigmoid", name=OUTPUT_NAME)(hidden)
    model = tf.keras.Model(inputs={"features": features}, outputs={OUTPUT_NAME: score})

    sample = {"features": tf.zeros([4, FEATURE_COUNT], dtype=tf.float32)}
    inference_output = model(sample, training=False)
    training_output = model(sample, training=True)

    assert tuple(inference_output[OUTPUT_NAME].shape) == (4, 1)
    assert tuple(training_output[OUTPUT_NAME].shape) == (4, 1)
    assert model.get_layer("projection").get_config()["units"] == 16
    print(
        {
            "input": tuple(sample["features"].shape),
            "output": tuple(inference_output[OUTPUT_NAME].shape),
            "output_name": OUTPUT_NAME,
            "dtype": inference_output[OUTPUT_NAME].dtype.name,
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Check the tensor contract without importing TensorFlow.",
    )
    args = parser.parse_args()
    if args.simulate:
        run_simulation()
    else:
        run_tensorflow()


if __name__ == "__main__":
    main()
