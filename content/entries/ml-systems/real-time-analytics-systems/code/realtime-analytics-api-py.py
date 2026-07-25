from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import asyncio
import json
import time
import logging
from dataclasses import asdict
import numpy as np
import redis
from kafka import KafkaProducer
import uvicorn
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FeatureRequest(BaseModel):
    user_id: str
    features: Optional[List[str]] = None  # If None, return all features

class PredictionRequest(BaseModel):
    user_id: str
    model_name: str = "fraud_detector"
    features: Optional[Dict[str, float]] = None  # Override features

class AnalyticsEvent(BaseModel):
    user_id: str
    event_type: str
    properties: Dict[str, Any]
    session_id: Optional[str] = None
    timestamp: Optional[float] = Field(default_factory=time.time)

class BatchPredictionRequest(BaseModel):
    requests: List[PredictionRequest]
    return_features: bool = False

class RealTimeAnalyticsService:
    """Production real-time analytics service"""

    def __init__(self):
        # Redis connection for features and models
        self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

        # Kafka producer for events
        self.kafka_producer = KafkaProducer(
            bootstrap_servers=['localhost:9092'],
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )

        # Cache for frequently accessed features
        self.feature_cache = {}
        self.cache_ttl = 60  # seconds

        # Performance monitoring
        self.request_count = 0
        self.total_response_time = 0.0

        # Models registry
        self.models = {}

    async def get_features(self, user_id: str, feature_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get real-time features for a user"""
        try:
            start_time = time.time()

            # Check cache first
            cache_key = f"features_cache:{user_id}"
            cached_features = self.feature_cache.get(cache_key)

            if cached_features and time.time() - cached_features['timestamp'] < self.cache_ttl:
                features = cached_features['features']
            else:
                # Get from Redis
                if feature_names:
                    features = {}
                    for feature_name in feature_names:
                        key = f"feature:{user_id}:{feature_name}"
                        value = self.redis_client.get(key)
                        if value:
                            features[feature_name] = json.loads(value)
                else:
                    # Get all features
                    pattern = f"feature:{user_id}:*"
                    keys = self.redis_client.keys(pattern)
                    features = {}

                    for key in keys:
                        feature_name = key.split(':')[-1]
                        value = self.redis_client.get(key)
                        if value:
                            features[feature_name] = json.loads(value)

                # Cache the result
                self.feature_cache[cache_key] = {
                    'features': features,
                    'timestamp': time.time()
                }

            processing_time = time.time() - start_time
            self._update_metrics(processing_time)

            return {
                'user_id': user_id,
                'features': features,
                'retrieved_at': time.time(),
                'processing_time_ms': processing_time * 1000,
                'cache_hit': cached_features is not None
            }

        except Exception as e:
            logger.error(f"Feature retrieval error for {user_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def make_prediction(self, request: PredictionRequest) -> Dict[str, Any]:
        """Make real-time prediction for a user"""
        try:
            start_time = time.time()

            # Get features (either provided or from feature store)
            if request.features:
                features = request.features
            else:
                feature_result = await self.get_features(request.user_id)
                raw_features = feature_result['features']
                # Extract just the values
                features = {name: data['value'] for name, data in raw_features.items() if 'value' in data}

            if not features:
                raise HTTPException(status_code=400, detail="No features available for prediction")

            # Get model metrics to check if model is healthy
            metrics_key = f"metrics:{request.model_name}:latest"
            metrics_data = self.redis_client.get(metrics_key)

            if not metrics_data:
                raise HTTPException(status_code=404, detail=f"Model {request.model_name} not found")

            metrics = json.loads(metrics_data)

            # Simple prediction logic (in production, this would call the actual model)
            # For demonstration, we'll use the features to compute a score
            prediction_score = self._compute_prediction_score(features)
            confidence = min(0.95, max(0.05, abs(prediction_score - 0.5) * 2))

            processing_time = time.time() - start_time
            self._update_metrics(processing_time)

            result = {
                'user_id': request.user_id,
                'model_name': request.model_name,
                'prediction': prediction_score,
                'confidence': confidence,
                'features_used': list(features.keys()),
                'model_version': metrics['model_version'],
                'predicted_at': time.time(),
                'processing_time_ms': processing_time * 1000
            }

            # Log prediction for model monitoring
            await self._log_prediction(result)

            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Prediction error for {request.user_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def batch_predictions(self, request: BatchPredictionRequest) -> Dict[str, Any]:
        """Make batch predictions"""
        try:
            start_time = time.time()

            # Process all predictions concurrently
            tasks = [self.make_prediction(pred_req) for pred_req in request.requests]
            predictions = await asyncio.gather(*tasks, return_exceptions=True)

            # Separate successful predictions from errors
            successful = []
            errors = []

            for i, pred in enumerate(predictions):
                if isinstance(pred, Exception):
                    errors.append({
                        'request_index': i,
                        'user_id': request.requests[i].user_id,
                        'error': str(pred)
                    })
                else:
                    successful.append(pred)

            processing_time = time.time() - start_time

            return {
                'predictions': successful,
                'errors': errors,
                'total_requests': len(request.requests),
                'successful_count': len(successful),
                'error_count': len(errors),
                'batch_processing_time_ms': processing_time * 1000
            }

        except Exception as e:
            logger.error(f"Batch prediction error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def ingest_event(self, event: AnalyticsEvent, background_tasks: BackgroundTasks):
        """Ingest real-time analytics event"""
        try:
            # Add to Kafka for processing
            event_data = event.dict()
            self.kafka_producer.send('user_events', event_data)

            # Also trigger immediate feature computation for critical features
            background_tasks.add_task(self._compute_immediate_features, event)

            return {
                'status': 'accepted',
                'event_id': f"{event.user_id}_{event.timestamp}",
                'timestamp': event.timestamp
            }

        except Exception as e:
            logger.error(f"Event ingestion error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def _compute_immediate_features(self, event: AnalyticsEvent):
        """Compute immediate features for low-latency use cases"""
        try:
            # Simple immediate feature computation
            user_id = event.user_id

            # Update event count
            count_key = f"feature:{user_id}:event_count_realtime"
            current_count = self.redis_client.get(count_key)
            new_count = (int(current_count) if current_count else 0) + 1

            feature_data = {
                'value': new_count,
                'timestamp': event.timestamp,
                'window_type': 'immediate'
            }

            self.redis_client.setex(count_key, 3600, json.dumps(feature_data))

            # Update last event type
            event_type_key = f"feature:{user_id}:last_event_type"
            event_type_data = {
                'value': event.event_type,
                'timestamp': event.timestamp,
                'window_type': 'immediate'
            }

            self.redis_client.setex(event_type_key, 3600, json.dumps(event_type_data))

        except Exception as e:
            logger.error(f"Immediate feature computation error: {e}")

    def _compute_prediction_score(self, features: Dict[str, Any]) -> float:
        """Simple prediction score computation"""
        # In production, this would use the actual trained model
        # For demo, we'll use a simple weighted combination

        weights = {
            'click_rate_1m': 0.3,
            'session_duration': 0.2,
            'event_velocity': 0.15,
            'conversion_score': 0.25,
            'engagement_trend': 0.1
        }

        score = 0.5  # baseline
        total_weight = 0

        for feature_name, weight in weights.items():
            if feature_name in features:
                value = features[feature_name]
                if isinstance(value, (int, float)):
                    score += weight * min(1.0, max(0.0, value))
                    total_weight += weight

        # Normalize
        if total_weight > 0:
            score = score / (0.5 + total_weight)  # Adjust for baseline

        return max(0.0, min(1.0, score))

    async def _log_prediction(self, prediction_result: Dict[str, Any]):
        """Log prediction for monitoring and feedback"""
        try:
            log_entry = {
                'type': 'prediction',
                'timestamp': time.time(),
                **prediction_result
            }

            self.kafka_producer.send('prediction_logs', log_entry)
            self.kafka_producer.flush()

        except Exception as e:
            logger.error(f"Prediction logging error: {e}")

    def _update_metrics(self, processing_time: float):
        """Update service performance metrics"""
        self.request_count += 1
        self.total_response_time += processing_time

    def get_service_stats(self) -> Dict[str, Any]:
        """Get service performance statistics"""
        avg_response_time = (
            self.total_response_time / max(1, self.request_count)
        )

        return {
            'total_requests': self.request_count,
            'average_response_time_ms': avg_response_time * 1000,
            'cache_size': len(self.feature_cache),
            'models_loaded': len(self.models),
            'uptime_seconds': time.time() - self.start_time if hasattr(self, 'start_time') else 0
        }

# Initialize service
analytics_service = RealTimeAnalyticsService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    analytics_service.start_time = time.time()
    logger.info("Real-Time Analytics Service started")
    yield
    logger.info("Real-Time Analytics Service shutting down")
    analytics_service.kafka_producer.close()

# FastAPI app
app = FastAPI(
    title="Real-Time Analytics Service",
    description="Production real-time analytics and ML inference API",
    version="1.0.0",
    lifespan=lifespan
)

@app.post("/features", response_model=Dict[str, Any])
async def get_user_features(request: FeatureRequest):
    """Get real-time features for a user"""
    return await analytics_service.get_features(request.user_id, request.features)

@app.post("/predict", response_model=Dict[str, Any])
async def make_prediction(request: PredictionRequest):
    """Make real-time prediction"""
    return await analytics_service.make_prediction(request)

@app.post("/predict/batch", response_model=Dict[str, Any])
async def batch_predict(request: BatchPredictionRequest):
    """Make batch predictions"""
    return await analytics_service.batch_predictions(request)

@app.post("/events", response_model=Dict[str, Any])
async def ingest_event(event: AnalyticsEvent, background_tasks: BackgroundTasks):
    """Ingest analytics event for real-time processing"""
    return await analytics_service.ingest_event(event, background_tasks)

@app.get("/stats")
async def get_stats():
    """Get service performance statistics"""
    return analytics_service.get_service_stats()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Redis connection
        analytics_service.redis_client.ping()
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "services": {
                "redis": "connected",
                "kafka": "connected"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {e}")

if __name__ == "__main__":
    uvicorn.run(
        "realtime_analytics_api:app",
        host="0.0.0.0",
        port=8000,
        workers=1
    )
