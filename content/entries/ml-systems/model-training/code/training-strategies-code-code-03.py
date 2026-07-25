import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict
import copy

class ElasticWeightConsolidation:
    def __init__(self, model: nn.Module, lambda_ewc: float = 1000):
        self.model = model
        self.lambda_ewc = lambda_ewc
        self.fisher_information = {}
        self.optimal_params = {}

    def compute_fisher_information(self, dataloader, num_samples: int = 1000):
        """Compute Fisher Information Matrix for important parameters"""

        self.model.eval()
        fisher_info = {}

        # Initialize Fisher information
        for name, param in self.model.named_parameters():
            if param.requires_grad:
                fisher_info[name] = torch.zeros_like(param)

        samples_processed = 0

        for batch_idx, (data, target) in enumerate(dataloader):
            if samples_processed >= num_samples:
                break

            data, target = data.cuda(), target.cuda()

            # Forward pass
            output = self.model(data)
            loss = F.cross_entropy(output, target)

            # Compute gradients
            self.model.zero_grad()
            loss.backward()

            # Accumulate squared gradients (Fisher Information)
            for name, param in self.model.named_parameters():
                if param.requires_grad and param.grad is not None:
                    fisher_info[name] += param.grad.data ** 2

            samples_processed += len(data)

        # Normalize by number of samples
        for name in fisher_info:
            fisher_info[name] /= samples_processed

        self.fisher_information = fisher_info

        # Store optimal parameters from previous task
        self.optimal_params = {}
        for name, param in self.model.named_parameters():
            if param.requires_grad:
                self.optimal_params[name] = param.data.clone()

    def ewc_loss(self) -> torch.Tensor:
        """Compute EWC regularization loss"""

        ewc_loss = 0

        for name, param in self.model.named_parameters():
            if name in self.fisher_information:
                # Fisher-weighted squared difference from optimal parameters
                fisher = self.fisher_information[name]
                optimal = self.optimal_params[name]
                ewc_loss += (fisher * (param - optimal) ** 2).sum()

        return self.lambda_ewc / 2 * ewc_loss

class ContinualLearner:
    def __init__(self, model: nn.Module, config):
        self.model = model
        self.config = config
        self.ewc = ElasticWeightConsolidation(model, config.lambda_ewc)
        self.task_history = []

    def learn_task(self, task_id: int, train_loader, val_loader,
                   num_epochs: int = 10):
        """Learn a new task with EWC regularization"""

        print(f"Learning Task {task_id}")

        optimizer = torch.optim.Adam(
            self.model.parameters(),
            lr=self.config.learning_rate
        )

        best_val_acc = 0

        for epoch in range(num_epochs):
            self.model.train()
            total_loss = 0

            for batch_idx, (data, target) in enumerate(train_loader):
                data, target = data.cuda(), target.cuda()

                optimizer.zero_grad()

                # Forward pass
                output = self.model(data)

                # Task-specific loss
                task_loss = F.cross_entropy(output, target)

                # EWC regularization loss (prevents forgetting)
                ewc_loss = self.ewc.ewc_loss() if len(self.task_history) > 0 else 0

                # Total loss
                total_loss_batch = task_loss + ewc_loss
                total_loss_batch.backward()
                optimizer.step()

                total_loss += total_loss_batch.item()

            # Validation
            val_acc = self._evaluate(val_loader)

            if val_acc > best_val_acc:
                best_val_acc = val_acc

            print(f"Epoch {epoch+1}/{num_epochs}, "
                  f"Loss: {total_loss/len(train_loader):.4f}, "
                  f"Val Acc: {val_acc:.4f}")

        # After learning the task, compute Fisher information
        self.ewc.compute_fisher_information(train_loader)

        # Add task to history
        self.task_history.append({
            'task_id': task_id,
            'best_accuracy': best_val_acc
        })

        return best_val_acc
