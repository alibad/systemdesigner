import torch
import torch.nn as nn
from typing import List, Dict
import copy

class FederatedTrainer:
    def __init__(self, global_model, clients, config):
        self.global_model = global_model
        self.clients = clients
        self.config = config
        self.round_num = 0

    def federated_averaging(self, client_models: List[nn.Module],
                          client_weights: List[float]) -> nn.Module:
        """FedAvg algorithm implementation"""

        # Initialize averaged model with zeros
        global_dict = self.global_model.state_dict()
        for key in global_dict.keys():
            global_dict[key] = torch.zeros_like(global_dict[key])

        # Weighted average of client models
        total_weight = sum(client_weights)
        for client_model, weight in zip(client_models, client_weights):
            client_dict = client_model.state_dict()
            for key in global_dict.keys():
                global_dict[key] += (weight / total_weight) * client_dict[key]

        # Update global model
        updated_model = copy.deepcopy(self.global_model)
        updated_model.load_state_dict(global_dict)
        return updated_model

    def train_round(self) -> Dict:
        """Execute one round of federated training"""

        # Sample clients for this round
        selected_clients = self._sample_clients()

        client_models = []
        client_weights = []
        client_metrics = []

        # Train on each selected client
        for client in selected_clients:
            # Send global model to client
            client_model = copy.deepcopy(self.global_model)

            # Local training
            local_metrics = client.local_train(
                model=client_model,
                epochs=self.config.local_epochs,
                learning_rate=self.config.local_lr
            )

            client_models.append(client_model)
            client_weights.append(len(client.dataset))  # Weight by dataset size
            client_metrics.append(local_metrics)

        # Aggregate models using FedAvg
        self.global_model = self.federated_averaging(client_models, client_weights)

        # Evaluate global model
        global_metrics = self._evaluate_global_model()

        self.round_num += 1

        return {
            'round': self.round_num,
            'global_metrics': global_metrics,
            'client_metrics': client_metrics,
            'num_clients': len(selected_clients)
        }

class FederatedClient:
    def __init__(self, client_id: str, dataset, device):
        self.client_id = client_id
        self.dataset = dataset
        self.device = device

    def local_train(self, model: nn.Module, epochs: int,
                   learning_rate: float) -> Dict:
        """Train model locally on client data"""

        model.to(self.device)
        model.train()

        optimizer = torch.optim.SGD(model.parameters(), lr=learning_rate)
        criterion = nn.CrossEntropyLoss()

        dataloader = torch.utils.data.DataLoader(
            self.dataset, batch_size=32, shuffle=True
        )

        total_loss = 0
        num_samples = 0

        for epoch in range(epochs):
            for batch_idx, (data, target) in enumerate(dataloader):
                data, target = data.to(self.device), target.to(self.device)

                optimizer.zero_grad()
                output = model(data)
                loss = criterion(output, target)
                loss.backward()
                optimizer.step()

                total_loss += loss.item() * len(data)
                num_samples += len(data)

        avg_loss = total_loss / num_samples

        return {
            'client_id': self.client_id,
            'loss': avg_loss,
            'num_samples': num_samples
        }
