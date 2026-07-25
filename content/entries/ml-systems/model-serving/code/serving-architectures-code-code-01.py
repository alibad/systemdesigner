from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import numpy as np
import asyncio
from typing import List, Dict
import uvicorn

class ModelServer:
    def __init__(self, model_path: str, device: str = "cuda"):
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        self.model = self._load_model(model_path)
        self.model.eval()

        # Warmup model with dummy input
        self._warmup_model()

        # Initialize metrics
        self.request_count = 0
        self.total_inference_time = 0

    def _load_model(self, model_path: str):
        """Load and optimize model for serving"""
        model = torch.jit.load(model_path, map_location=self.device)

        # Optimize for inference
        if self.device.type == 'cuda':
            model = torch.compile(model)  # PyTorch 2.0 optimization

        return model

    def _warmup_model(self):
        """Warmup model to avoid cold start latency"""
        dummy_input = torch.randn(1, 224, 224, 3).to(self.device)

        # Run several warmup inferences
        with torch.no_grad():
            for _ in range(10):
                _ = self.model(dummy_input)

        # Synchronize CUDA operations
        if self.device.type == 'cuda':
            torch.cuda.synchronize()

    async def predict(self, input_data: np.ndarray) -> Dict:
        """Perform model inference"""
        start_time = asyncio.get_event_loop().time()

        try:
            # Preprocess input
            tensor_input = torch.from_numpy(input_data).float().to(self.device)

            # Add batch dimension if needed
            if tensor_input.dim() == 3:
                tensor_input = tensor_input.unsqueeze(0)

            # Inference
            with torch.no_grad():
                logits = self.model(tensor_input)
                probabilities = torch.softmax(logits, dim=1)

                # Get top predictions
                top_probs, top_indices = torch.topk(probabilities, k=5)

            # Post-process results
            predictions = {
                'predictions': [
                    {
                        'class_id': int(idx),
                        'confidence': float(prob)
                    }
                    for prob, idx in zip(top_probs[0], top_indices[0])
                ],
                'inference_time_ms': (asyncio.get_event_loop().time() - start_time) * 1000
            }

            # Update metrics
            self.request_count += 1
            self.total_inference_time += predictions['inference_time_ms']

            return predictions

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

# FastAPI application
app = FastAPI(title="ML Model Serving API", version="1.0.0")

# Global model server instance
model_server = None

class PredictionRequest(BaseModel):
    data: List[List[float]]

class PredictionResponse(BaseModel):
    predictions: List[Dict]
    inference_time_ms: float

@app.on_event("startup")
async def startup_event():
    global model_server
    model_server = ModelServer("/path/to/model.pt")

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Prediction endpoint"""
    if model_server is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    input_array = np.array(request.data)
    result = await model_server.predict(input_array)

    return PredictionResponse(**result)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model_server is not None,
        "device": str(model_server.device) if model_server else None
    }

@app.get("/metrics")
async def get_metrics():
    """Get serving metrics"""
    if model_server is None:
        return {"error": "Model not loaded"}

    avg_latency = (
        model_server.total_inference_time / model_server.request_count
        if model_server.request_count > 0 else 0
    )

    return {
        "total_requests": model_server.request_count,
        "average_latency_ms": avg_latency,
        "throughput_rps": model_server.request_count / 3600
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=1)
