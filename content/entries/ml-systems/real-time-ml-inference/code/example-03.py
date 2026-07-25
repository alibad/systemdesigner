import numpy as np
from sklearn.linear_model import SGDRegressor
from sklearn.preprocessing import StandardScaler
import pickle
import threading
import time
from collections import deque
import logging

class OnlineLearningSystem:
    def __init__(self, initial_model_path=None, learning_rate=0.01):
        # Initialize or load existing model
        if initial_model_path:
            self.load_model(initial_model_path)
        else:
            self.model = SGDRegressor(
                learning_rate='adaptive',
                eta0=learning_rate,
                random_state=42
            )
            self.scaler = StandardScaler()
            self.is_fitted = False

        # Online learning configuration
        self.batch_size = 100
        self.update_frequency = 300  # seconds
        self.performance_window = 1000

        # Data buffers for streaming updates
        self.feature_buffer = deque(maxlen=10000)
        self.target_buffer = deque(maxlen=10000)
        self.prediction_errors = deque(maxlen=self.performance_window)

        # Thread-safe model access
        self.model_lock = threading.RLock()

        # Performance tracking
        self.model_version = 1
        self.last_update_time = time.time()
        self.training_metrics = {
            'samples_processed': 0,
            'avg_error': 0.0,
            'model_drift_score': 0.0
        }

        # Start background update thread
        self.update_thread = threading.Thread(target=self._update_loop, daemon=True)
        self.update_thread.start()

    def predict(self, features: np.ndarray) -> Dict:
        """Thread-safe prediction with performance tracking"""
        start_time = time.time()

        with self.model_lock:
            if not self.is_fitted:
                return {"error": "Model not yet trained"}

            # Normalize features
            features_scaled = self.scaler.transform(features.reshape(1, -1))

            # Make prediction
            prediction = self.model.predict(features_scaled)[0]

            # Calculate prediction uncertainty (for SGD models)
            decision_function = getattr(self.model, 'decision_function', None)
            uncertainty = 0.1  # Default uncertainty

            if decision_function:
                decision_score = decision_function(features_scaled)[0]
                uncertainty = 1.0 / (1.0 + abs(decision_score))  # Higher uncertainty for scores near 0

        latency_ms = (time.time() - start_time) * 1000

        return {
            "prediction": prediction,
            "uncertainty": uncertainty,
            "model_version": self.model_version,
            "latency_ms": round(latency_ms, 2)
        }

    def add_feedback(self, features: np.ndarray, true_value: float):
        """Add new training sample for online learning"""
        self.feature_buffer.append(features)
        self.target_buffer.append(true_value)

        # Track prediction error if we have a prediction
        if self.is_fitted:
            with self.model_lock:
                features_scaled = self.scaler.transform(features.reshape(1, -1))
                predicted_value = self.model.predict(features_scaled)[0]
                error = abs(predicted_value - true_value)
                self.prediction_errors.append(error)

    def _update_loop(self):
        """Background thread for periodic model updates"""
        while True:
            try:
                time.sleep(self.update_frequency)

                if len(self.feature_buffer) >= self.batch_size:
                    self._incremental_update()

            except Exception as e:
                logging.error(f"Error in update loop: {e}")

    def _incremental_update(self):
        """Perform incremental model update"""
        logging.info(f"Starting incremental update with {len(self.feature_buffer)} samples")

        # Prepare batch data
        batch_features = np.array(list(self.feature_buffer)[-self.batch_size:])
        batch_targets = np.array(list(self.target_buffer)[-self.batch_size:])

        with self.model_lock:
            # Update scaler incrementally
            if self.is_fitted:
                # Partial fit for online scaling
                self.scaler.partial_fit(batch_features)
            else:
                # Initial fit
                self.scaler.fit(batch_features)

            # Scale features
            batch_features_scaled = self.scaler.transform(batch_features)

            # Update model incrementally
            if self.is_fitted:
                self.model.partial_fit(batch_features_scaled, batch_targets)
            else:
                self.model.fit(batch_features_scaled, batch_targets)
                self.is_fitted = True

            # Update model version and metrics
            self.model_version += 1
            self.training_metrics['samples_processed'] += len(batch_features)

            if self.prediction_errors:
                self.training_metrics['avg_error'] = np.mean(self.prediction_errors)

                # Detect model drift (increasing error trend)
                if len(self.prediction_errors) >= self.performance_window:
                    recent_errors = list(self.prediction_errors)[-100:]
                    older_errors = list(self.prediction_errors)[-200:-100]

                    if older_errors:  # Avoid division by zero
                        drift_score = np.mean(recent_errors) / np.mean(older_errors)
                        self.training_metrics['model_drift_score'] = drift_score

                        if drift_score > 1.5:  # 50% increase in error
                            logging.warning(f"Model drift detected: {drift_score:.2f}")

        self.last_update_time = time.time()
        logging.info(f"Model updated to version {self.model_version}")

    def get_model_stats(self) -> Dict:
        """Get current model performance statistics"""
        return {
            "model_version": self.model_version,
            "is_fitted": self.is_fitted,
            "samples_in_buffer": len(self.feature_buffer),
            "last_update_time": self.last_update_time,
            "training_metrics": self.training_metrics.copy(),
            "time_since_update": time.time() - self.last_update_time
        }

    def save_model(self, path: str):
        """Save current model state"""
        with self.model_lock:
            model_data = {
                'model': self.model,
                'scaler': self.scaler,
                'is_fitted': self.is_fitted,
                'model_version': self.model_version
            }

            with open(path, 'wb') as f:
                pickle.dump(model_data, f)

    def load_model(self, path: str):
        """Load model state"""
        with open(path, 'rb') as f:
            model_data = pickle.load(f)

        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.is_fitted = model_data['is_fitted']
        self.model_version = model_data.get('model_version', 1)

# Usage example
online_ml = OnlineLearningSystem()

# Simulate streaming predictions and feedback
for i in range(1000):
    # Generate sample data
    features = np.random.randn(10)  # 10-dimensional features

    # Make prediction
    result = online_ml.predict(features)

    # Simulate getting true value and providing feedback
    true_value = np.sum(features) + np.random.normal(0, 0.1)  # Simple linear relationship
    online_ml.add_feedback(features, true_value)

    if i % 100 == 0:
        stats = online_ml.get_model_stats()
        print(f"Step {i}: Avg Error = {stats['training_metrics']['avg_error']:.4f}")

# Save final model
online_ml.save_model("online_model.pkl")
