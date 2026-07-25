import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

class EWC:
    def __init__(self, model: nn.Module, dataset: DataLoader, importance: float = 1000):
        self.model = model
        self.importance = importance
        self.params = {name: p.clone().detach() for name, p in model.named_parameters() if p.requires_grad}
        self.fisher = self._compute_fisher_information(dataset)

    def _compute_fisher_information(self, dataset: DataLoader):
        """Compute Fisher Information Matrix diagonal"""
        fisher = {}
        for name, param in self.model.named_parameters():
            if param.requires_grad:
                fisher[name] = torch.zeros_like(param)

        self.model.eval()
        for data, target in dataset:
            self.model.zero_grad()
            output = self.model(data)
            loss = F.log_softmax(output, dim=1)[range(target.shape[0]), target].mean()
            loss.backward()

            for name, param in self.model.named_parameters():
                if param.requires_grad and param.grad is not None:
                    fisher[name] += param.grad.data ** 2

        # Normalize by dataset size
        for name in fisher:
            fisher[name] /= len(dataset)

        return fisher

    def penalty(self):
        """Compute EWC penalty term"""
        loss = 0
        for name, param in self.model.named_parameters():
            if param.requires_grad and name in self.fisher:
                loss += (self.fisher[name] * (param - self.params[name]) ** 2).sum()
        return self.importance * loss

# Usage in training loop
def train_with_ewc(model, new_task_loader, ewc=None, epochs=10):
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    for epoch in range(epochs):
        for data, target in new_task_loader:
            optimizer.zero_grad()

            # Standard loss on new task
            output = model(data)
            task_loss = F.cross_entropy(output, target)

            # Add EWC penalty if available
            total_loss = task_loss
            if ewc is not None:
                total_loss += ewc.penalty()

            total_loss.backward()
            optimizer.step()
