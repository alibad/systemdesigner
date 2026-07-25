from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import numpy as np
from typing import Dict, List, Optional
import asyncio
import time
from functools import lru_cache

class PredictionRequest(BaseModel):
    user_id: str
    features: List[float]
    model_variant: Optional[str] = "default"
    latency_budget_ms: Optional[int] = 100

class MultiModelServer:
    def __init__(self):
        # Load multiple model variants
        self.models = {
            "fast": torch.jit.load("models/fast_model.pt"),      # 10ms, 85% accuracy
            "default": torch.jit.load("models/default_model.pt"), # 50ms, 92% accuracy
            "accurate": torch.jit.load("models/accurate_model.pt") # 200ms, 95% accuracy
        }

        # Model performance profiles
        self.model_profiles = {
            "fast": {"latency_ms": 10, "accuracy": 0.85, "memory_mb": 50},
            "default": {"latency_ms": 50, "accuracy": 0.92, "memory_mb": 200},
            "accurate": {"latency_ms": 200, "accuracy": 0.95, "memory_mb": 800}
        }

        # Performance monitoring
        self.performance_stats = {model: [] for model in self.models.keys()}

        for model in self.models.values():
            model.eval()

    def select_optimal_model(self, latency_budget_ms: int, user_tier: str = "standard") -> str:
        """Dynamically select best model based on constraints"""

        # Premium users get better models
        if user_tier == "premium":
            latency_budget_ms *= 2

        # Find best model within latency budget
        best_model = "fast"  # fallback
        best_accuracy = 0

        for model_name, profile in self.model_profiles.items():
            if profile["latency_ms"] <= latency_budget_ms:
                if profile["accuracy"] > best_accuracy:
                    best_accuracy = profile["accuracy"]
                    best_model = model_name

        return best_model

    async def predict_with_model(self, model_name: str, features: np.ndarray) -> Dict:
        """Execute prediction with specific model"""
        start_time = time.time()

        model = self.models[model_name]
        feature_tensor = torch.tensor(features, dtype=torch.float32).unsqueeze(0)

        with torch.no_grad():
            logits = model(feature_tensor)
            probabilities = torch.softmax(logits, dim=1)
            prediction = torch.argmax(probabilities, dim=1)

        latency_ms = (time.time() - start_time) * 1000

        # Update performance stats
        self.performance_stats[model_name].append(latency_ms)
        if len(self.performance_stats[model_name]) > 1000:
            self.performance_stats[model_name].pop(0)  # Keep recent 1000

        return {
            "prediction": prediction.item(),
            "confidence": probabilities.max().item(),
            "probabilities": probabilities.squeeze().tolist(),
            "model_used": model_name,
            "latency_ms": round(latency_ms, 2)
        }

    @lru_cache(maxsize=10000)
    def get_user_tier(self, user_id: str) -> str:
        """Cache user tier lookup"""
        # In practice, this would query user database
        return "premium" if user_id.endswith("_premium") else "standard"

app = FastAPI()
ml_server = MultiModelServer()

@app.post("/predict")
async def predict(request: PredictionRequest):
    try:
        # Determine user tier and optimal model
        user_tier = ml_server.get_user_tier(request.user_id)

        if request.model_variant == "auto":
            model_name = ml_server.select_optimal_model(
                request.latency_budget_ms, user_tier
            )
        else:
            model_name = request.model_variant

        if model_name not in ml_server.models:
            raise HTTPException(status_code=400, detail=f"Model {model_name} not available")

        # Execute prediction
        features = np.array(request.features)
        result = await ml_server.predict_with_model(model_name, features)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    """Health check with model performance stats"""
    stats = {}
    for model_name, latencies in ml_server.performance_stats.items():
        if latencies:
            stats[model_name] = {
                "avg_latency_ms": round(np.mean(latencies), 2),
                "p95_latency_ms": round(np.percentile(latencies, 95), 2),
                "request_count": len(latencies)
            }

    return {"status": "healthy", "model_stats": stats}

# Run with: uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
