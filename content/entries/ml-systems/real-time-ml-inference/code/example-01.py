import asyncio
import numpy as np
from kafka import KafkaConsumer, KafkaProducer
import redis
import torch
from concurrent.futures import ThreadPoolExecutor
import time

class StreamingMLPipeline:
    def __init__(self, model_path, redis_host='localhost'):
        # Load optimized model (TorchScript, ONNX, etc.)
        self.model = torch.jit.load(model_path)
        self.model.eval()

        # Feature cache for low-latency serving
        self.redis_client = redis.Redis(host=redis_host, decode_responses=True)

        # Async processing pools
        self.feature_executor = ThreadPoolExecutor(max_workers=4)
        self.inference_executor = ThreadPoolExecutor(max_workers=8)

        # Kafka setup for streaming
        self.consumer = KafkaConsumer(
            'ml-features',
            bootstrap_servers=['localhost:9092'],
            value_deserializer=lambda x: json.loads(x.decode('utf-8'))
        )
        self.producer = KafkaProducer(
            bootstrap_servers=['localhost:9092'],
            value_serializer=lambda x: json.dumps(x).encode('utf-8')
        )

    async def process_stream(self):
        """Process streaming data with batching for efficiency"""
        batch = []
        batch_size = 32
        last_batch_time = time.time()

        for message in self.consumer:
            data = message.value
            batch.append(data)

            # Process batch when full or timeout reached
            should_process = (
                len(batch) >= batch_size or
                time.time() - last_batch_time > 0.050  # 50ms timeout
            )

            if should_process:
                await self.process_batch(batch)
                batch = []
                last_batch_time = time.time()

    async def process_batch(self, batch):
        """Parallel feature extraction and inference"""
        # Extract features in parallel
        feature_tasks = []
        for item in batch:
            task = asyncio.create_task(
                self.get_features_async(item['user_id'], item['context'])
            )
            feature_tasks.append(task)

        features = await asyncio.gather(*feature_tasks)

        # Batch inference
        feature_tensor = torch.stack([f for f in features if f is not None])

        with torch.no_grad():
            predictions = self.model(feature_tensor)
            scores = torch.softmax(predictions, dim=1)

        # Send results back
        for i, item in enumerate(batch):
            if features[i] is not None:
                result = {
                    'user_id': item['user_id'],
                    'prediction': scores[i].tolist(),
                    'timestamp': time.time(),
                    'latency_ms': (time.time() - item['timestamp']) * 1000
                }
                self.producer.send('ml-predictions', value=result)

    async def get_features_async(self, user_id, context):
        """Async feature retrieval with caching"""
        cache_key = f"features:{user_id}:{hash(str(context))}"

        # Try cache first
        cached = self.redis_client.get(cache_key)
        if cached:
            return torch.tensor(json.loads(cached))

        # Compute features if not cached
        features = await asyncio.get_event_loop().run_in_executor(
            self.feature_executor,
            self.compute_features,
            user_id, context
        )

        # Cache for future requests (TTL: 5 minutes)
        self.redis_client.setex(cache_key, 300, json.dumps(features.tolist()))

        return features

    def compute_features(self, user_id, context):
        """Feature computation (can be expensive)"""
        # Real feature engineering would be more complex
        user_features = self.get_user_profile(user_id)
        context_features = self.extract_context_features(context)

        # Combine and normalize
        combined = np.concatenate([user_features, context_features])
        return torch.tensor(combined, dtype=torch.float32)

# Usage
async def main():
    pipeline = StreamingMLPipeline('optimized_model.pt')
    await pipeline.process_stream()

if __name__ == "__main__":
    asyncio.run(main())
