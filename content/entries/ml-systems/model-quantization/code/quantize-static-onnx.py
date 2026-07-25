from collections.abc import Iterator

import numpy as np
from onnxruntime.quantization import (
    CalibrationDataReader,
    QuantFormat,
    QuantType,
    quantize_static,
)


class RepresentativeReader(CalibrationDataReader):
    def __init__(self, batches: list[np.ndarray]) -> None:
        self._batches = iter(batches)

    def get_next(self) -> dict[str, np.ndarray] | None:
        batch = next(self._batches, None)
        return None if batch is None else {"input_ids": batch}


def calibration_batches() -> Iterator[np.ndarray]:
    """Load versioned, representative inputs through production preprocessing."""
    raise NotImplementedError


reader = RepresentativeReader(list(calibration_batches()))
quantize_static(
    model_input="model-fp32.onnx",
    model_output="model-int8-qdq.onnx",
    calibration_data_reader=reader,
    quant_format=QuantFormat.QDQ,
    activation_type=QuantType.QInt8,
    weight_type=QuantType.QInt8,
    nodes_to_exclude=["output_projection"],
)
