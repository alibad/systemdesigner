from kafka import KafkaConsumer, KafkaProducer
import torch
import json
import numpy as np
from typing import Dict, Any
import threading
import time

class StreamingModelServer:
    def __init__(self, model_path: str, kafka_config: Dict):
        self.model = torch.jit.load(model_path)
        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

        # Kafka configuration
        self.kafka_config = kafka_config
        self.consumer = KafkaConsumer(
            kafka_config['input_topic'],
            bootstrap_servers=kafka_config['bootstrap_servers'],
            value_deserializer=lambda x: json.loads(x.decode('utf-8')),
            auto_offset_reset='latest',
            group_id=kafka_config['consumer_group']
        )

        self.producer = KafkaProducer(
            bootstrap_servers=kafka_config['bootstrap_servers'],
            value_serializer=lambda x: json.dumps(x).encode('utf-8')
        )

        # Metrics
        self.processed_count = 0
        self.error_count = 0
        self.start_time = time.time()

        # Buffer for batch processing
        self.batch_buffer = []
        self.batch_size = kafka_config.get('batch_size', 32)
        self.buffer_lock = threading.Lock()

    def preprocess_message(self, message: Dict) -> torch.Tensor:
        """Preprocess incoming message"""
        try:
            # Extract features from message
            features = np.array(message['features'], dtype=np.float32)

            # Convert to tensor
            tensor = torch.from_numpy(features).to(self.device)

            # Add batch dimension
            if tensor.dim() == 1:
                tensor = tensor.unsqueeze(0)

            return tensor

        except Exception as e:
            raise ValueError(f"Preprocessing error: {str(e)}")

    def predict_batch(self, batch_tensors: List[torch.Tensor]) -> List[Dict]:
        """Batch prediction for better throughput"""
        if not batch_tensors:
            return []

        try:
            # Stack tensors into batch
            batch = torch.cat(batch_tensors, dim=0)

            with torch.no_grad():
                logits = self.model(batch)
                probabilities = torch.softmax(logits, dim=1)
                predictions = torch.argmax(probabilities, dim=1)
                confidences = torch.max(probabilities, dim=1).values

                results = []
                for i in range(len(batch_tensors)):
                    result = {
                        'prediction': predictions[i].item(),
                        'confidence': confidences[i].item(),
                        'probabilities': probabilities[i].cpu().numpy().tolist()
                    }
                    results.append(result)

                return results

        except Exception as e:
            # Fallback to individual predictions
            return [self.predict_single(tensor) for tensor in batch_tensors]

    def process_message(self, message: Dict) -> None:
        """Process a single message"""
        try:
            # Preprocess
            input_tensor = self.preprocess_message(message)

            # Add to batch buffer
            with self.buffer_lock:
                self.batch_buffer.append({
                    'tensor': input_tensor,
                    'metadata': message.get('metadata', {}),
                    'message_id': message.get('id', 'unknown')
                })

                # Process batch if buffer is full
                if len(self.batch_buffer) >= self.batch_size:
                    self._process_batch()

        except Exception as e:
            self.error_count += 1

    def _process_batch(self):
        """Process accumulated batch"""
        if not self.batch_buffer:
            return

        # Extract tensors and metadata
        tensors = [item['tensor'] for item in self.batch_buffer]
        metadata_list = [item['metadata'] for item in self.batch_buffer]
        message_ids = [item['message_id'] for item in self.batch_buffer]

        # Clear buffer
        self.batch_buffer.clear()

        # Predict
        predictions = self.predict_batch(tensors)

        # Send results
        for pred, metadata, msg_id in zip(predictions, metadata_list, message_ids):
            result = {
                'message_id': msg_id,
                'prediction': pred,
                'metadata': metadata,
                'timestamp': time.time()
            }

            self.producer.send(
                self.kafka_config['output_topic'],
                value=result
            )

        self.processed_count += len(predictions)

    def run(self):
        """Main processing loop"""

        # Start batch processor thread
        batch_thread = threading.Thread(target=self._batch_processor, daemon=True)
        batch_thread.start()

        try:
            for message in self.consumer:
                self.process_message(message.value)

        except KeyboardInterrupt:
            print("Shutting down...")
        finally:
            self.consumer.close()
            self.producer.close()

    def _batch_processor(self):
        """Background thread to process batches periodically"""
        while True:
            time.sleep(0.1)  # 100ms intervals

            with self.buffer_lock:
                if self.batch_buffer:
                    self._process_batch()

# Usage
if __name__ == "__main__":
    config = {
        'input_topic': 'ml-inference-requests',
        'output_topic': 'ml-inference-results',
        'bootstrap_servers': ['localhost:9092'],
        'consumer_group': 'ml-inference-group',
        'batch_size': 32
    }

    server = StreamingModelServer('/path/to/model.pt', config)
    server.run()
