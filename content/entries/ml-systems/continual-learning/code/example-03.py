import random
from collections import deque
import numpy as np

class ExperienceReplayBuffer:
    def __init__(self, capacity: int, sampling_strategy: str = 'random'):
        self.capacity = capacity
        self.buffer = deque(maxlen=capacity)
        self.sampling_strategy = sampling_strategy
        self.task_boundaries = []

    def add_batch(self, data_batch, labels_batch, task_id):
        """Add a batch of examples to the buffer"""
        for i in range(len(data_batch)):
            self.buffer.append({
                'data': data_batch[i],
                'label': labels_batch[i],
                'task_id': task_id,
                'timestamp': len(self.buffer)
            })

    def sample(self, batch_size: int, current_task_id: int = None):
        """Sample examples from the buffer"""
        if len(self.buffer) < batch_size:
            return list(self.buffer)

        if self.sampling_strategy == 'random':
            return random.sample(list(self.buffer), batch_size)

        elif self.sampling_strategy == 'balanced':
            # Sample equally from all tasks
            task_ids = set(item['task_id'] for item in self.buffer)
            samples_per_task = batch_size // len(task_ids)
            samples = []

            for task_id in task_ids:
                task_samples = [item for item in self.buffer if item['task_id'] == task_id]
                samples.extend(random.sample(task_samples,
                                           min(samples_per_task, len(task_samples))))

            return samples
