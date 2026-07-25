"""Exercise eager/graph execution and a bounded tf.data input contract.

Run with TensorFlow installed for the real path, or pass --simulate for a
dependency-light contract check.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from typing import Any


BATCH_SIZE = 64
FEATURE_COUNT = 16


@dataclass(frozen=True)
class SimulatedStep:
    input_ms: float
    device_ms: float
    prefetch_batches: int
    batch_size: int

    @property
    def steady_step_ms(self) -> float:
        if self.prefetch_batches > 0:
            return max(self.input_ms, self.device_ms)
        return self.input_ms + self.device_ms

    @property
    def records_per_second(self) -> int:
        return round(self.batch_size * 1000 / self.steady_step_ms)


def run_simulation() -> None:
    step = SimulatedStep(
        input_ms=24.0,
        device_ms=29.0,
        prefetch_batches=2,
        batch_size=BATCH_SIZE,
    )
    result = asdict(step)
    result.update(
        {
            "steady_step_ms": step.steady_step_ms,
            "records_per_second": step.records_per_second,
            "invariant": "prefetch overlaps stages but does not make the slower stage faster",
        }
    )
    assert result["steady_step_ms"] == 29.0
    assert result["records_per_second"] == 2207
    print(json.dumps(result, indent=2, sort_keys=True))


def load_tensorflow() -> Any:
    try:
        import tensorflow as tf  # type: ignore[import-not-found]
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "TensorFlow is not installed. Re-run with --simulate for the dependency-light check."
        ) from exc
    return tf


def build_dataset(tf: Any) -> Any:
    def make_record(index: Any) -> tuple[Any, Any]:
        base = tf.cast(index % 97, tf.float32)
        features = base + tf.cast(tf.range(FEATURE_COUNT), tf.float32)
        label = tf.cast(index % 2, tf.float32)
        return features, tf.reshape(label, [1])

    def normalize_batch(features: Any, labels: Any) -> tuple[Any, Any]:
        scale = tf.maximum(tf.reduce_max(features, axis=1, keepdims=True), 1.0)
        return features / scale, labels

    return (
        tf.data.Dataset.range(2048)
        .shuffle(2048, seed=17, reshuffle_each_iteration=True)
        .map(make_record, num_parallel_calls=tf.data.AUTOTUNE, deterministic=True)
        .batch(BATCH_SIZE, drop_remainder=True)
        .map(normalize_batch, num_parallel_calls=tf.data.AUTOTUNE, deterministic=True)
        .prefetch(tf.data.AUTOTUNE)
    )


def run_tensorflow() -> None:
    tf = load_tensorflow()
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(FEATURE_COUNT,), dtype=tf.float32),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )
    optimizer = tf.keras.optimizers.Adam(learning_rate=1e-3)

    @tf.function(
        input_signature=[
            tf.TensorSpec([None, FEATURE_COUNT], tf.float32, name="features"),
            tf.TensorSpec([None, 1], tf.float32, name="labels"),
        ]
    )
    def train_step(features: Any, labels: Any) -> dict[str, Any]:
        with tf.GradientTape() as tape:
            logits = model(features, training=True)
            loss = tf.reduce_mean(
                tf.nn.sigmoid_cross_entropy_with_logits(labels=labels, logits=logits)
            )
        gradients = tape.gradient(loss, model.trainable_variables)
        optimizer.apply_gradients(zip(gradients, model.trainable_variables))
        return {"loss": loss, "batch_size": tf.shape(features)[0]}

    dataset = build_dataset(tf)
    eager_features, eager_labels = next(iter(dataset))
    eager_logits = model(eager_features, training=False)
    print(
        "eager",
        {
            "features": tuple(eager_features.shape),
            "labels": tuple(eager_labels.shape),
            "logits": tuple(eager_logits.shape),
        },
    )

    for features, labels in dataset.take(3):
        metrics = train_step(features, labels)
        print(
            "graph",
            {
                "loss": round(float(metrics["loss"].numpy()), 6),
                "batch_size": int(metrics["batch_size"].numpy()),
            },
        )

    concrete = train_step.get_concrete_function()
    positional_specs, keyword_specs = concrete.structured_input_signature
    assert not keyword_specs
    assert positional_specs[0].shape.as_list() == [None, FEATURE_COUNT]
    assert positional_specs[1].shape.as_list() == [None, 1]
    print(
        {
            "graph_input_shapes": [spec.shape.as_list() for spec in positional_specs],
            "graph_input_dtypes": [spec.dtype.name for spec in positional_specs],
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Run the dependency-light pipeline arithmetic instead of importing TensorFlow.",
    )
    args = parser.parse_args()
    if args.simulate:
        run_simulation()
    else:
        run_tensorflow()


if __name__ == "__main__":
    main()
