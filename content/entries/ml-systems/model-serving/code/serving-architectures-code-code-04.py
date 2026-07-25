import torch
import torch.nn as nn
from torch.quantization import quantize_dynamic
import numpy as np
import onnx
import onnxruntime as ort
from typing import Dict, Tuple
import psutil
import time

class EdgeModelOptimizer:
    def __init__(self, model: nn.Module):
        self.original_model = model
        self.optimized_models = {}

    def quantize_model(self, model: nn.Module, quantization_type: str = 'dynamic') -> nn.Module:
        """Apply quantization for smaller model size and faster inference"""

        if quantization_type == 'dynamic':
            # Dynamic quantization - quantize weights, activations computed in fp32
            quantized_model = quantize_dynamic(
                model,
                {nn.Linear, nn.Conv2d},
                dtype=torch.qint8
            )
        elif quantization_type == 'static':
            # Static quantization - requires calibration data
            model.eval()
            model.qconfig = torch.quantization.get_default_qconfig('fbgemm')
            torch.quantization.prepare(model, inplace=True)

            # Calibrate with representative data
            # calibrate_model(model, calibration_data)

            quantized_model = torch.quantization.convert(model, inplace=False)
        else:
            raise ValueError(f"Unknown quantization type: {quantization_type}")

        return quantized_model

    def convert_to_onnx(self, model: nn.Module, input_shape: Tuple,
                       output_path: str) -> str:
        """Convert PyTorch model to ONNX for broader deployment"""

        model.eval()
        dummy_input = torch.randn(1, *input_shape)

        torch.onnx.export(
            model,
            dummy_input,
            output_path,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )

        return output_path

    def prune_model(self, model: nn.Module, pruning_ratio: float = 0.2) -> nn.Module:
        """Apply magnitude-based pruning to reduce model size"""

        import torch.nn.utils.prune as prune

        # Apply unstructured pruning to linear and conv layers
        for module in model.modules():
            if isinstance(module, (nn.Linear, nn.Conv2d)):
                prune.l1_unstructured(module, name='weight', amount=pruning_ratio)
                prune.remove(module, 'weight')  # Make pruning permanent

        return model

class EdgeInferenceEngine:
    def __init__(self, model_path: str, optimization_config: Dict):
        self.config = optimization_config
        self.model = self._load_optimized_model(model_path)

        # Performance monitoring
        self.inference_times = []
        self.memory_usage = []

    def _load_optimized_model(self, model_path: str):
        """Load model with appropriate optimizations for edge"""

        if model_path.endswith('.onnx'):
            # ONNX Runtime for optimized inference
            providers = ['CPUExecutionProvider']
            if self.config.get('use_gpu', False):
                providers.insert(0, 'CUDAExecutionProvider')

            session = ort.InferenceSession(model_path, providers=providers)
            return session
        else:
            # PyTorch model
            model = torch.jit.load(model_path, map_location='cpu')
            model.eval()

            # Apply optimizations
            if self.config.get('quantize', False):
                optimizer = EdgeModelOptimizer(model)
                model = optimizer.quantize_model(model)

            return model

    def predict(self, input_data: np.ndarray) -> Dict:
        """Perform inference with performance monitoring"""

        start_time = time.time()
        memory_before = psutil.Process().memory_info().rss / 1024 / 1024  # MB

        try:
            if isinstance(self.model, ort.InferenceSession):
                # ONNX Runtime inference
                input_name = self.model.get_inputs()[0].name
                result = self.model.run(None, {input_name: input_data})
                logits = result[0]
            else:
                # PyTorch inference
                with torch.no_grad():
                    input_tensor = torch.from_numpy(input_data).float()
                    if input_tensor.dim() == 3:
                        input_tensor = input_tensor.unsqueeze(0)

                    logits = self.model(input_tensor).numpy()

            # Post-process
            probabilities = self._softmax(logits)
            prediction = np.argmax(probabilities, axis=1)[0]
            confidence = np.max(probabilities)

            # Record performance metrics
            inference_time = (time.time() - start_time) * 1000  # ms
            memory_after = psutil.Process().memory_info().rss / 1024 / 1024  # MB

            self.inference_times.append(inference_time)
            self.memory_usage.append(memory_after - memory_before)

            return {
                'prediction': int(prediction),
                'confidence': float(confidence),
                'inference_time_ms': inference_time,
                'memory_delta_mb': memory_after - memory_before
            }

        except Exception as e:
            raise RuntimeError(f"Edge inference error: {str(e)}")

    def _softmax(self, x):
        """Numerically stable softmax"""
        exp_x = np.exp(x - np.max(x, axis=1, keepdims=True))
        return exp_x / np.sum(exp_x, axis=1, keepdims=True)

    def get_performance_stats(self) -> Dict:
        """Get performance statistics"""

        if not self.inference_times:
            return {"error": "No inference data available"}

        return {
            'avg_inference_time_ms': np.mean(self.inference_times),
            'p95_inference_time_ms': np.percentile(self.inference_times, 95),
            'avg_memory_usage_mb': np.mean(self.memory_usage),
            'total_inferences': len(self.inference_times)
        }
