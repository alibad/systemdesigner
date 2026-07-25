import numpy as np
from typing import Dict, List, Tuple
import matplotlib.pyplot as plt

class ContinualLearningEvaluator:
    def __init__(self):
        self.task_performance_history = {}  # task_id -> [performance_over_time]
        self.task_timestamps = {}  # task_id -> learning_time

    def evaluate_continual_learning(
        self,
        model,
        task_sequence: List[Tuple[str, DataLoader]],
        test_sets: Dict[str, DataLoader]
    ) -> Dict[str, float]:
        """Comprehensive evaluation of continual learning performance"""

        results = {
            'forward_transfer': [],
            'backward_transfer': [],
            'forgetting': [],
            'average_accuracy': [],
            'learning_efficiency': []
        }

        task_performances = {}  # task_id -> performance_after_each_task

        for task_idx, (task_id, train_loader) in enumerate(task_sequence):
            # Train on current task
            model = self._train_task(model, train_loader, task_id)

            # Evaluate on all seen tasks
            current_performances = {}
            for eval_task_id in test_sets:
                if eval_task_id in [t[0] for t in task_sequence[:task_idx+1]]:
                    performance = self._evaluate_model(model, test_sets[eval_task_id])
                    current_performances[eval_task_id] = performance

            task_performances[task_id] = current_performances

            # Calculate metrics
            if task_idx > 0:
                # Forward transfer
                ft = self._calculate_forward_transfer(
                    task_performances, task_id, task_idx
                )
                results['forward_transfer'].append(ft)

                # Backward transfer
                bt = self._calculate_backward_transfer(
                    task_performances, task_idx
                )
                results['backward_transfer'].append(bt)

                # Forgetting
                forgetting = self._calculate_forgetting(
                    task_performances, task_idx
                )
                results['forgetting'].append(forgetting)

            # Average accuracy
            avg_acc = np.mean(list(current_performances.values()))
            results['average_accuracy'].append(avg_acc)

        return results
