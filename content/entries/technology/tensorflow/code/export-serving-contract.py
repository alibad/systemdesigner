"""Export and inspect an explicit TensorFlow serving signature.

The real path creates a SavedModel in a temporary directory. The --simulate
path validates a dependency-light manifest with the same public contract.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path
from typing import Any


EXPECTED_CONTRACT = {
    "signature": "serving_default",
    "input_name": "features",
    "input_dtype": "float32",
    "input_shape": [None, 32],
    "output_name": "risk_score",
    "output_dtype": "float32",
    "output_shape": [None, 1],
}


def validate_contract(actual: dict[str, Any]) -> None:
    for key, expected in EXPECTED_CONTRACT.items():
        value = actual.get(key)
        if value != expected:
            raise ValueError(f"{key}: expected {expected!r}, received {value!r}")


def run_simulation() -> None:
    with tempfile.TemporaryDirectory(prefix="tensorflow-contract-") as directory:
        manifest_path = Path(directory) / "serving-contract.json"
        manifest_path.write_text(json.dumps(EXPECTED_CONTRACT, indent=2), encoding="utf-8")
        loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
        validate_contract(loaded)
        print(json.dumps({"status": "pass", "contract": loaded}, indent=2, sort_keys=True))


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

    class ScoreModule(tf.Module):
        @tf.function(
            input_signature=[
                tf.TensorSpec([None, 32], tf.float32, name="features")
            ]
        )
        def serve(self, features: Any) -> dict[str, Any]:
            score = tf.reduce_mean(features, axis=1, keepdims=True)
            return {"risk_score": tf.math.sigmoid(score)}

    module = ScoreModule()
    with tempfile.TemporaryDirectory(prefix="tensorflow-saved-model-") as directory:
        tf.saved_model.save(
            module,
            directory,
            signatures={"serving_default": module.serve},
        )
        loaded = tf.saved_model.load(directory)
        signature = loaded.signatures["serving_default"]
        _, inputs = signature.structured_input_signature
        outputs = signature.structured_outputs
        input_spec = inputs["features"]
        output_spec = outputs["risk_score"]
        actual = {
            "signature": "serving_default",
            "input_name": "features",
            "input_dtype": input_spec.dtype.name,
            "input_shape": input_spec.shape.as_list(),
            "output_name": "risk_score",
            "output_dtype": output_spec.dtype.name,
            "output_shape": output_spec.shape.as_list(),
        }
        validate_contract(actual)
        smoke_output = signature(features=tf.zeros([2, 32], tf.float32))
        assert tuple(smoke_output["risk_score"].shape) == (2, 1)
        print(json.dumps({"status": "pass", "contract": actual}, indent=2, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Validate a serving manifest without importing TensorFlow.",
    )
    args = parser.parse_args()
    if args.simulate:
        run_simulation()
    else:
        run_tensorflow()


if __name__ == "__main__":
    main()
