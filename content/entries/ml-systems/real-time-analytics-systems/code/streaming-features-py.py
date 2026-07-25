from kafka import KafkaConsumer, KafkaProducer
from typing import Dict, List, Any, Optional
import json
import time
import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from redis import Redis
import asyncio
from collections import defaultdict, deque

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class StreamingEvent:
    user_id: str
    event_type: str
    timestamp: float
    properties: Dict[str, Any]
    session_id: Optional[str] = None

@dataclass
class ComputedFeature:
    feature_name: str
    feature_value: float
    user_id: str
    timestamp: float
    window_type: str
    ttl_seconds: int = 3600

class RealTimeFeatureEngine:
    """Production-ready real-time feature computation engine"""

    def __init__(self,
                 kafka_bootstrap_servers: str = "localhost:9092",
                 redis_host: str = "localhost",
                 redis_port: int = 6379):

        # Kafka setup
        self.consumer = KafkaConsumer(
            'user_events',
            bootstrap_servers=kafka_bootstrap_servers,
            auto_offset_reset='latest',
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

        self.producer = KafkaProducer(
            bootstrap_servers=kafka_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )

        # Redis for real-time state
        self.redis_client = Redis(host=redis_host, port=redis_port, decode_responses=True)

        # In-memory windows for fast computation
        self.sliding_windows = defaultdict(lambda: defaultdict(deque))
        self.window_configs = {
            '1m': 60,
            '5m': 300,
            '15m': 900,
            '1h': 3600
        }

        # Feature computation functions
        self.feature_computers = {
            'click_rate_1m': self._compute_click_rate,
            'session_duration': self._compute_session_duration,
            'event_velocity': self._compute_event_velocity,
            'conversion_score': self._compute_conversion_score,
            'engagement_trend': self._compute_engagement_trend,
            'anomaly_score': self._compute_anomaly_score
        }

        # Performance monitoring
        self.processed_events = 0
        self.processing_times = deque(maxlen=1000)
        self.last_stats_time = time.time()

    async def process_stream(self):
        """Main streaming processing loop"""
        logger.info("Starting real-time feature processing...")

        try:
            for message in self.consumer:
                start_time = time.time()

                # Parse event
                event_data = message.value
                event = StreamingEvent(**event_data)

                # Compute features
                features = await self._compute_all_features(event)

                # Store features
                await self._store_features(features)

                # Publish computed features
                await self._publish_features(features)

                # Update performance metrics
                processing_time = time.time() - start_time
                self.processing_times.append(processing_time)
                self.processed_events += 1

                # Log stats every 1000 events
                if self.processed_events % 1000 == 0:
                    await self._log_performance_stats()

        except Exception as e:
            logger.error(f"Stream processing error: {e}")
            raise

    async def _compute_all_features(self, event: StreamingEvent) -> List[ComputedFeature]:
        """Compute all features for an event"""
        features = []

        # Update sliding windows first
        await self._update_windows(event)

        # Compute each feature
        for feature_name, compute_func in self.feature_computers.items():
            try:
                feature_value = await compute_func(event)
                if feature_value is not None:
                    feature = ComputedFeature(
                        feature_name=feature_name,
                        feature_value=feature_value,
                        user_id=event.user_id,
                        timestamp=event.timestamp,
                        window_type='streaming'
                    )
                    features.append(feature)
            except Exception as e:
                logger.error(f"Error computing {feature_name}: {e}")

        return features

    async def _update_windows(self, event: StreamingEvent):
        """Update sliding windows with new event"""
        current_time = event.timestamp
        user_id = event.user_id

        # Add to all window types
        for window_name, window_size in self.window_configs.items():
            window = self.sliding_windows[user_id][window_name]

            # Add new event
            window.append((current_time, event))

            # Remove old events outside window
            cutoff_time = current_time - window_size
            while window and window[0][0] < cutoff_time:
                window.popleft()

    async def _compute_click_rate(self, event: StreamingEvent) -> Optional[float]:
        """Compute click rate in last 1 minute"""
        window = self.sliding_windows[event.user_id]['1m']
        if not window:
            return None

        total_events = len(window)
        click_events = sum(1 for _, e in window if e.event_type == 'click')

        return click_events / max(total_events, 1)

    async def _compute_session_duration(self, event: StreamingEvent) -> Optional[float]:
        """Compute current session duration"""
        if not event.session_id:
            return None

        # Get session start from Redis
        session_key = f"session:{event.session_id}"
        session_start = self.redis_client.get(session_key)

        if not session_start:
            # First event in session
            self.redis_client.setex(session_key, 3600, str(event.timestamp))
            return 0.0
        else:
            return event.timestamp - float(session_start)

    async def _compute_event_velocity(self, event: StreamingEvent) -> Optional[float]:
        """Compute events per minute velocity"""
        window = self.sliding_windows[event.user_id]['1m']
        if len(window) < 2:
            return 0.0

        # Events per minute
        return len(window)

    async def _compute_conversion_score(self, event: StreamingEvent) -> Optional[float]:
        """Compute conversion propensity score"""
        window_5m = self.sliding_windows[event.user_id]['5m']
        if not window_5m:
            return 0.0

        # Simple scoring based on event types and frequency
        event_weights = {
            'page_view': 0.1,
            'click': 0.3,
            'add_to_cart': 0.7,
            'purchase': 1.0,
            'search': 0.2
        }

        score = 0.0
        for _, e in window_5m:
            weight = event_weights.get(e.event_type, 0.0)
            score += weight

        # Normalize by window size
        return min(score / 10, 1.0)

    async def _compute_engagement_trend(self, event: StreamingEvent) -> Optional[float]:
        """Compute engagement trend (increasing/decreasing)"""
        window_15m = self.sliding_windows[event.user_id]['15m']
        if len(window_15m) < 10:
            return 0.0

        # Split into two halves and compare event rates
        events = list(window_15m)
        mid_point = len(events) // 2

        first_half_rate = mid_point / 450  # events per second in first 7.5 min
        second_half_rate = (len(events) - mid_point) / 450  # events per second in last 7.5 min

        if first_half_rate == 0:
            return 1.0 if second_half_rate > 0 else 0.0

        trend = (second_half_rate - first_half_rate) / first_half_rate
        return max(-1.0, min(1.0, trend))  # Clamp between -1 and 1

    async def _compute_anomaly_score(self, event: StreamingEvent) -> Optional[float]:
        """Compute anomaly score based on user behavior"""
        window_1h = self.sliding_windows[event.user_id]['1h']
        if len(window_1h) < 5:
            return 0.0

        # Get historical average from Redis
        avg_key = f"user_avg:{event.user_id}"
        historical_avg = self.redis_client.get(avg_key)

        current_rate = len(window_1h) / 3600  # events per second

        if historical_avg:
            hist_rate = float(historical_avg)
            if hist_rate > 0:
                deviation = abs(current_rate - hist_rate) / hist_rate
                anomaly_score = min(deviation, 1.0)
            else:
                anomaly_score = 1.0 if current_rate > 0 else 0.0
        else:
            anomaly_score = 0.0

        # Update historical average
        new_avg = current_rate if not historical_avg else (float(historical_avg) * 0.9 + current_rate * 0.1)
        self.redis_client.setex(avg_key, 86400, str(new_avg))

        return anomaly_score

    async def _store_features(self, features: List[ComputedFeature]):
        """Store computed features in Redis"""
        pipe = self.redis_client.pipeline()

        for feature in features:
            key = f"feature:{feature.user_id}:{feature.feature_name}"
            value = {
                'value': feature.feature_value,
                'timestamp': feature.timestamp,
                'window_type': feature.window_type
            }

            # Store with TTL
            pipe.setex(key, feature.ttl_seconds, json.dumps(value))

        pipe.execute()

    async def _publish_features(self, features: List[ComputedFeature]):
        """Publish computed features to Kafka"""
        for feature in features:
            message = {
                'user_id': feature.user_id,
                'feature_name': feature.feature_name,
                'feature_value': feature.feature_value,
                'timestamp': feature.timestamp,
                'window_type': feature.window_type
            }

            self.producer.send('computed_features', message)

        # Ensure delivery
        self.producer.flush()

    async def _log_performance_stats(self):
        """Log performance statistics"""
        current_time = time.time()
        elapsed = current_time - self.last_stats_time

        if self.processing_times:
            avg_processing_time = np.mean(list(self.processing_times))
            p95_processing_time = np.percentile(list(self.processing_times), 95)
            p99_processing_time = np.percentile(list(self.processing_times), 99)
        else:
            avg_processing_time = p95_processing_time = p99_processing_time = 0

        events_per_second = 1000 / elapsed if elapsed > 0 else 0

        logger.info(f"""
        Performance Stats:
        - Events processed: {self.processed_events}
        - Events/sec: {events_per_second:.1f}
        - Avg processing time: {avg_processing_time*1000:.2f}ms
        - P95 processing time: {p95_processing_time*1000:.2f}ms
        - P99 processing time: {p99_processing_time*1000:.2f}ms
        - Active windows: {sum(len(windows) for windows in self.sliding_windows.values())}
        """)

        self.last_stats_time = current_time

    def get_feature(self, user_id: str, feature_name: str) -> Optional[Dict[str, Any]]:
        """Get latest feature value for a user"""
        key = f"feature:{user_id}:{feature_name}"
        value = self.redis_client.get(key)

        if value:
            return json.loads(value)
        return None

    def get_all_features(self, user_id: str) -> Dict[str, Any]:
        """Get all features for a user"""
        pattern = f"feature:{user_id}:*"
        keys = self.redis_client.keys(pattern)

        features = {}
        for key in keys:
            feature_name = key.split(':')[-1]
            value = self.redis_client.get(key)
            if value:
                features[feature_name] = json.loads(value)

        return features

# Usage example
async def run_feature_engine():
    engine = RealTimeFeatureEngine()

    try:
        await engine.process_stream()
    except KeyboardInterrupt:
        logger.info("Shutting down feature engine...")
    except Exception as e:
        logger.error(f"Feature engine error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(run_feature_engine())
