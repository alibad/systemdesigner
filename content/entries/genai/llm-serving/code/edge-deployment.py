# Edge Deployment with ONNX and TensorRT
import onnxruntime as ort
import numpy as np
from transformers import AutoTokenizer
import torch
from typing import List, Dict
import time
import logging

class EdgeLLMService:
    def __init__(self, model_path: str, device: str = "cpu"):
        self.device = device
        self.model_path = model_path
        self.session = None
        self.tokenizer = None

        # Performance optimization settings
        self.providers = self._get_providers()
        self.session_options = self._get_session_options()

    def _get_providers(self) -> List[str]:
        """Get available execution providers"""
        providers = []

        if self.device == "cuda" and "CUDAExecutionProvider" in ort.get_available_providers():
            providers.append("CUDAExecutionProvider")
        elif self.device == "tensorrt" and "TensorrtExecutionProvider" in ort.get_available_providers():
            providers.append("TensorrtExecutionProvider")

        providers.append("CPUExecutionProvider")
        return providers

    def _get_session_options(self) -> ort.SessionOptions:
        """Configure ONNX session for optimal performance"""
        options = ort.SessionOptions()

        # Enable optimizations
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        # Set thread settings for CPU
        if "CPUExecutionProvider" in self.providers:
            options.intra_op_num_threads = 4
            options.inter_op_num_threads = 4

        # Enable profiling for performance monitoring
        options.enable_profiling = True

        return options

    def load_model(self):
        """Load optimized model for edge deployment"""
        try:
            # Load ONNX model
            self.session = ort.InferenceSession(
                self.model_path,
                providers=self.providers,
                sess_options=self.session_options
            )

            # Load tokenizer
            tokenizer_path = self.model_path.replace(".onnx", "")
            self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)

            logging.info(f"Model loaded with providers: {self.session.get_providers()}")

        except Exception as e:
            logging.error(f"Failed to load model: {e}")
            raise

    def preprocess(self, text: str, max_length: int = 512) -> Dict[str, np.ndarray]:
        """Preprocess text for model input"""
        # Tokenize
        encoded = self.tokenizer(
            text,
            max_length=max_length,
            padding="max_length",
            truncation=True,
            return_tensors="np"
        )

        # Convert to model input format
        return {
            "input_ids": encoded["input_ids"].astype(np.int64),
            "attention_mask": encoded["attention_mask"].astype(np.int64)
        }

    def generate(self, prompt: str, max_new_tokens: int = 50,
                temperature: float = 0.7) -> str:
        """Generate text using edge-optimized model"""
        if self.session is None:
            raise RuntimeError("Model not loaded")

        start_time = time.time()

        # Preprocess input
        inputs = self.preprocess(prompt)

        # Run inference
        try:
            outputs = self.session.run(None, inputs)

            # Post-process output
            generated_ids = outputs[0]
            generated_text = self.tokenizer.decode(
                generated_ids[0],
                skip_special_tokens=True
            )

            inference_time = time.time() - start_time

            return {
                "generated_text": generated_text,
                "inference_time_ms": inference_time * 1000,
                "tokens_per_second": max_new_tokens / inference_time
            }

        except Exception as e:
            logging.error(f"Inference failed: {e}")
            raise

    def get_performance_stats(self) -> Dict:
        """Get performance statistics"""
        if self.session is None:
            return {}

        prof_file = self.session.end_profiling()
        return {
            "profiling_file": prof_file,
            "providers": self.session.get_providers(),
            "input_names": [inp.name for inp in self.session.get_inputs()],
            "output_names": [out.name for out in self.session.get_outputs()]
        }

# Model Optimization Pipeline
class ModelOptimizer:
    def __init__(self):
        self.supported_formats = ["onnx", "tensorrt", "quantized"]

    def optimize_for_edge(self, model_name: str, target_device: str = "cpu",
                         optimization_level: str = "aggressive") -> str:
        """Optimize model for edge deployment"""

        # Load original model
        model = AutoModelForCausalLM.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)

        # Apply optimizations based on target device
        if target_device == "cpu":
            optimized_model = self._optimize_for_cpu(model)
        elif target_device == "cuda":
            optimized_model = self._optimize_for_gpu(model)
        elif target_device == "mobile":
            optimized_model = self._optimize_for_mobile(model)

        # Convert to ONNX
        onnx_path = self._convert_to_onnx(optimized_model, tokenizer)

        # Apply post-conversion optimizations
        if optimization_level == "aggressive":
            onnx_path = self._apply_aggressive_optimizations(onnx_path)

        return onnx_path

    def _optimize_for_cpu(self, model):
        """CPU-specific optimizations"""
        # Quantization
        quantized_model = torch.quantization.quantize_dynamic(
            model, {torch.nn.Linear}, dtype=torch.qint8
        )
        return quantized_model

    def _optimize_for_gpu(self, model):
        """GPU-specific optimizations"""
        # Convert to half precision
        return model.half()

    def _optimize_for_mobile(self, model):
        """Mobile-specific optimizations"""
        # Aggressive quantization and pruning
        # This would include more sophisticated optimization techniques
        return self._optimize_for_cpu(model)

    def _convert_to_onnx(self, model, tokenizer) -> str:
        """Convert PyTorch model to ONNX"""
        # Create dummy input
        dummy_input = torch.randint(0, 1000, (1, 512))

        onnx_path = "optimized_model.onnx"

        # Export to ONNX
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            input_names=["input_ids"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch_size", 1: "sequence_length"},
                "logits": {0: "batch_size", 1: "sequence_length"}
            },
            opset_version=14
        )

        return onnx_path

    def _apply_aggressive_optimizations(self, onnx_path: str) -> str:
        """Apply aggressive ONNX optimizations"""
        import onnxoptimizer

        # Load model
        model = onnx.load(onnx_path)

        # Apply optimizations
        optimized_model = onnxoptimizer.optimize(model, [
            'eliminate_nop_transpose',
            'eliminate_unused_initializer',
            'fuse_consecutive_transposes',
            'fuse_add_bias_into_conv',
            'fuse_bn_into_conv',
            'fuse_transpose_into_gemm'
        ])

        optimized_path = onnx_path.replace(".onnx", "_optimized.onnx")
        onnx.save(optimized_model, optimized_path)

        return optimized_path

# Edge Deployment Manager
class EdgeDeploymentManager:
    def __init__(self):
        self.edge_nodes = {}
        self.model_registry = {}

    def register_edge_node(self, node_id: str, capabilities: Dict):
        """Register an edge computing node"""
        self.edge_nodes[node_id] = {
            "capabilities": capabilities,
            "status": "available",
            "deployed_models": [],
            "last_heartbeat": time.time()
        }

    def deploy_model(self, model_id: str, target_nodes: List[str] = None):
        """Deploy model to edge nodes"""
        if target_nodes is None:
            # Auto-select nodes based on capabilities
            target_nodes = self._select_optimal_nodes(model_id)

        deployment_results = {}

        for node_id in target_nodes:
            if node_id not in self.edge_nodes:
                deployment_results[node_id] = {"status": "error", "message": "Node not found"}
                continue

            try:
                # Deploy model to node
                result = self._deploy_to_node(node_id, model_id)
                deployment_results[node_id] = result

                # Update node status
                if result["status"] == "success":
                    self.edge_nodes[node_id]["deployed_models"].append(model_id)

            except Exception as e:
                deployment_results[node_id] = {"status": "error", "message": str(e)}

        return deployment_results

    def _select_optimal_nodes(self, model_id: str) -> List[str]:
        """Select optimal nodes for model deployment"""
        model_requirements = self.model_registry[model_id]["requirements"]
        suitable_nodes = []

        for node_id, node_info in self.edge_nodes.items():
            capabilities = node_info["capabilities"]

            # Check if node meets requirements
            if (capabilities["memory_gb"] >= model_requirements["memory_gb"] and
                capabilities["compute_units"] >= model_requirements["compute_units"]):
                suitable_nodes.append(node_id)

        return suitable_nodes

    def _deploy_to_node(self, node_id: str, model_id: str) -> Dict:
        """Deploy model to specific edge node"""
        # This would implement the actual deployment logic
        # involving model transfer, container deployment, etc.
        return {"status": "success", "deployment_time": time.time()}

# Usage Example
if __name__ == "__main__":
    # Optimize model for edge
    optimizer = ModelOptimizer()
    optimized_path = optimizer.optimize_for_edge(
        "microsoft/DialoGPT-small",
        target_device="cpu",
        optimization_level="aggressive"
    )

    # Load and run edge service
    edge_service = EdgeLLMService(optimized_path, device="cpu")
    edge_service.load_model()

    # Generate text
    result = edge_service.generate("Hello, how are you?")
    print(f"Generated: {result['generated_text']}")
    print(f"Latency: {result['inference_time_ms']:.2f}ms")