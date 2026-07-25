import numpy as np
from sklearn.linear_model import SGDClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score
from typing import Dict, List, Any, Optional, Tuple
import joblib
import json
import time
import logging
from dataclasses import dataclass
from threading import Lock
import asyncio
from collections import deque
import redis
from kafka import KafkaConsumer, KafkaProducer

logger = logging.getLogger(__name__)

@dataclass
class TrainingExample:
    features: np.ndarray
    label: float
    timestamp: float
    weight: float = 1.0
    example_id: Optional[str] = None

@dataclass
class ModelMetrics:
    accuracy: float
    precision: float
    recall: float
    training_examples: int
    last_updated: float
    model_version: str

class OnlineLearningSystem:
    """Production online learning system with concept drift detection"""

    def __init__(self,
                 model_name: str = "fraud_detector",
                 kafka_bootstrap_servers: str = "localhost:9092",
                 redis_host: str = "localhost",
                 learning_rate: float = 0.01,
                 batch_size: int = 100):

        self.model_name = model_name
        self.learning_rate = learning_rate
        self.batch_size = batch_size

        # Online learning models
        self.model = SGDClassifier(
            loss='log_loss',  # Logistic regression
            learning_rate='adaptive',
            eta0=learning_rate,
            random_state=42
        )

        self.scaler = StandardScaler()
        self.model_lock = Lock()
        self.is_initialized = False

        # Kafka setup
        self.consumer = KafkaConsumer(
            'training_examples',
            bootstrap_servers=kafka_bootstrap_servers,
            auto_offset_reset='latest',
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

        self.producer = KafkaProducer(
            bootstrap_servers=kafka_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )

        # Redis for model storage and metrics
        self.redis_client = redis.Redis(host=redis_host, decode_responses=True)

        # Performance tracking
        self.training_buffer = deque(maxlen=batch_size)
        self.recent_performance = deque(maxlen=1000)
        self.drift_detection_window = deque(maxlen=500)
        self.model_version = 1
        self.examples_processed = 0

        # Concept drift detection
        self.baseline_accuracy = None
        self.drift_threshold = 0.05  # 5% accuracy drop triggers retraining
        self.min_examples_for_drift = 100

    async def start_online_learning(self):
        """Start the online learning process"""
        logger.info(f"Starting online learning for {self.model_name}")

        # Load existing model if available
        await self._load_model()

        try:
            for message in self.consumer:
                example_data = message.value
                example = TrainingExample(
                    features=np.array(example_data['features']),
                    label=example_data['label'],
                    timestamp=example_data.get('timestamp', time.time()),
                    weight=example_data.get('weight', 1.0),
                    example_id=example_data.get('example_id')
                )

                # Add to training buffer
                await self._add_training_example(example)

                # Check if we should update the model
                if len(self.training_buffer) >= self.batch_size:
                    await self._update_model()

                # Check for concept drift
                if len(self.drift_detection_window) >= self.min_examples_for_drift:
                    await self._check_concept_drift()

                self.examples_processed += 1

        except Exception as e:
            logger.error(f"Online learning error: {e}")
            raise

    async def _add_training_example(self, example: TrainingExample):
        """Add training example to buffer"""
        self.training_buffer.append(example)

        # Also track for drift detection
        if self.is_initialized:
            prediction = await self._predict_single(example.features)
            is_correct = (prediction > 0.5) == (example.label > 0.5)
            self.drift_detection_window.append(is_correct)

    async def _update_model(self):
        """Update model with batched examples"""
        if not self.training_buffer:
            return

        # Prepare batch data
        features_batch = np.array([ex.features for ex in self.training_buffer])
        labels_batch = np.array([ex.label for ex in self.training_buffer])
        weights_batch = np.array([ex.weight for ex in self.training_buffer])

        with self.model_lock:
            try:
                if not self.is_initialized:
                    # First batch - fit scaler and initialize model
                    self.scaler.fit(features_batch)
                    features_scaled = self.scaler.transform(features_batch)
                    self.model.fit(features_scaled, labels_batch, sample_weight=weights_batch)
                    self.is_initialized = True
                    logger.info("Model initialized with first batch")
                else:
                    # Subsequent batches - partial fit
                    features_scaled = self.scaler.transform(features_batch)
                    self.model.partial_fit(features_scaled, labels_batch, sample_weight=weights_batch)

                # Update performance metrics
                await self._update_performance_metrics(features_scaled, labels_batch)

                # Save model periodically
                if self.examples_processed % 1000 == 0:
                    await self._save_model()

                # Clear buffer
                self.training_buffer.clear()

                logger.info(f"Model updated with batch of {len(features_batch)} examples")

            except Exception as e:
                logger.error(f"Model update error: {e}")
                # Clear buffer on error to prevent infinite loop
                self.training_buffer.clear()

    async def _update_performance_metrics(self, features: np.ndarray, labels: np.ndarray):
        """Update and track model performance metrics"""
        if not self.is_initialized:
            return

        # Make predictions
        predictions = self.model.predict(features)
        probabilities = self.model.predict_proba(features)[:, 1]

        # Calculate metrics
        accuracy = accuracy_score(labels, predictions)
        precision = precision_score(labels, predictions, zero_division=0)
        recall = recall_score(labels, predictions, zero_division=0)

        # Store metrics
        metrics = ModelMetrics(
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            training_examples=self.examples_processed,
            last_updated=time.time(),
            model_version=str(self.model_version)
        )

        # Add to recent performance tracking
        self.recent_performance.append(accuracy)

        # Store in Redis
        await self._store_metrics(metrics)

        # Set baseline if not set
        if self.baseline_accuracy is None:
            self.baseline_accuracy = accuracy
            logger.info(f"Baseline accuracy set to {accuracy:.3f}")

    async def _check_concept_drift(self):
        """Check for concept drift and trigger retraining if needed"""
        if not self.baseline_accuracy or len(self.drift_detection_window) < self.min_examples_for_drift:
            return

        # Calculate recent accuracy
        recent_accuracy = sum(self.drift_detection_window) / len(self.drift_detection_window)

        # Check for significant drop
        accuracy_drop = self.baseline_accuracy - recent_accuracy

        if accuracy_drop > self.drift_threshold:
            logger.warning(f"Concept drift detected! Accuracy dropped by {accuracy_drop:.3f}")
            await self._handle_concept_drift(recent_accuracy)

        # Update baseline with weighted average
        self.baseline_accuracy = 0.95 * self.baseline_accuracy + 0.05 * recent_accuracy

    async def _handle_concept_drift(self, current_accuracy: float):
        """Handle detected concept drift"""
        logger.info("Handling concept drift - creating new model version")

        # Create new model version
        self.model_version += 1

        # Reset model with more aggressive learning
        with self.model_lock:
            self.model = SGDClassifier(
                loss='log_loss',
                learning_rate='adaptive',
                eta0=self.learning_rate * 2,  # Increase learning rate
                random_state=42
            )
            self.scaler = StandardScaler()
            self.is_initialized = False

        # Reset drift detection
        self.drift_detection_window.clear()
        self.baseline_accuracy = None

        # Notify about drift
        await self._notify_concept_drift(current_accuracy)

    async def _notify_concept_drift(self, accuracy: float):
        """Notify about concept drift event"""
        notification = {
            'event': 'concept_drift_detected',
            'model_name': self.model_name,
            'accuracy': accuracy,
            'new_model_version': self.model_version,
            'timestamp': time.time()
        }

        self.producer.send('model_events', notification)
        self.producer.flush()

    async def predict(self, features: np.ndarray) -> Tuple[float, float]:
        """Make prediction with confidence"""
        if not self.is_initialized:
            return 0.5, 0.0  # Default prediction

        with self.model_lock:
            features_scaled = self.scaler.transform(features.reshape(1, -1))
            prediction = self.model.predict_proba(features_scaled)[0]
            confidence = max(prediction) - min(prediction)
            return prediction[1], confidence  # Return probability of positive class

    async def _predict_single(self, features: np.ndarray) -> float:
        """Single prediction for internal use"""
        if not self.is_initialized:
            return 0.5

        with self.model_lock:
            features_scaled = self.scaler.transform(features.reshape(1, -1))
            return self.model.predict_proba(features_scaled)[0][1]

    async def _save_model(self):
        """Save model to Redis"""
        if not self.is_initialized:
            return

        try:
            with self.model_lock:
                # Serialize model and scaler
                model_data = {
                    'model': joblib.dump(self.model, None),
                    'scaler': joblib.dump(self.scaler, None),
                    'model_version': self.model_version,
                    'examples_processed': self.examples_processed,
                    'last_saved': time.time()
                }

            # Store in Redis
            key = f"model:{self.model_name}:latest"
            self.redis_client.set(key, json.dumps(model_data, default=str))

            logger.info(f"Model saved to Redis (version {self.model_version})")

        except Exception as e:
            logger.error(f"Model save error: {e}")

    async def _load_model(self):
        """Load model from Redis"""
        try:
            key = f"model:{self.model_name}:latest"
            model_data = self.redis_client.get(key)

            if model_data:
                data = json.loads(model_data)

                with self.model_lock:
                    self.model = joblib.load(data['model'])
                    self.scaler = joblib.load(data['scaler'])
                    self.model_version = data['model_version']
                    self.examples_processed = data['examples_processed']
                    self.is_initialized = True

                logger.info(f"Model loaded from Redis (version {self.model_version})")
            else:
                logger.info("No existing model found, starting fresh")

        except Exception as e:
            logger.error(f"Model load error: {e}")

    async def _store_metrics(self, metrics: ModelMetrics):
        """Store performance metrics"""
        key = f"metrics:{self.model_name}:latest"
        self.redis_client.set(key, json.dumps(metrics.__dict__))

        # Also store time series
        ts_key = f"metrics:{self.model_name}:timeseries"
        self.redis_client.lpush(ts_key, json.dumps({
            **metrics.__dict__,
            'timestamp': time.time()
        }))

        # Keep only last 1000 entries
        self.redis_client.ltrim(ts_key, 0, 999)

    def get_metrics(self) -> Optional[ModelMetrics]:
        """Get current model metrics"""
        key = f"metrics:{self.model_name}:latest"
        data = self.redis_client.get(key)

        if data:
            metrics_dict = json.loads(data)
            return ModelMetrics(**metrics_dict)
        return None

    def get_model_info(self) -> Dict[str, Any]:
        """Get model information and stats"""
        metrics = self.get_metrics()

        return {
            'model_name': self.model_name,
            'model_version': self.model_version,
            'examples_processed': self.examples_processed,
            'is_initialized': self.is_initialized,
            'baseline_accuracy': self.baseline_accuracy,
            'recent_performance_avg': np.mean(list(self.recent_performance)) if self.recent_performance else None,
            'current_metrics': metrics.__dict__ if metrics else None,
            'drift_detection_size': len(self.drift_detection_window)
        }

# Usage example
async def run_online_learning():
    system = OnlineLearningSystem(model_name="fraud_detector")

    try:
        await system.start_online_learning()
    except KeyboardInterrupt:
        logger.info("Shutting down online learning system...")
    except Exception as e:
        logger.error(f"Online learning error: {e}")

if __name__ == "__main__":
    asyncio.run(run_online_learning())
