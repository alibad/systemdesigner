import torch
import torch.nn as nn
import numpy as np
from typing import List, Dict
from sklearn.cluster import KMeans
from scipy.spatial.distance import cdist

class ActiveLearner:
    def __init__(self, model: nn.Module, initial_labeled_data,
                 unlabeled_data, config):
        self.model = model
        self.labeled_data = initial_labeled_data
        self.unlabeled_data = unlabeled_data
        self.config = config
        self.query_history = []

    def uncertainty_sampling(self, n_samples: int) -> List[int]:
        """Select samples with highest prediction uncertainty"""

        self.model.eval()
        uncertainties = []

        unlabeled_loader = torch.utils.data.DataLoader(
            self.unlabeled_data, batch_size=32, shuffle=False
        )

        with torch.no_grad():
            for data, _ in unlabeled_loader:
                data = data.cuda()

                # Get prediction probabilities
                logits = self.model(data)
                probs = torch.softmax(logits, dim=1)

                # Entropy-based uncertainty
                entropy = -torch.sum(probs * torch.log(probs + 1e-8), dim=1)
                uncertainties.extend(entropy.cpu().numpy())

        # Select indices with highest uncertainty
        uncertainty_indices = np.argsort(uncertainties)[-n_samples:]
        return uncertainty_indices.tolist()

    def diversity_sampling(self, n_samples: int) -> List[int]:
        """Select diverse samples using k-means clustering"""

        # Extract features from unlabeled data
        features = self._extract_features(self.unlabeled_data)

        # Perform k-means clustering
        kmeans = KMeans(n_clusters=n_samples, random_state=42)
        cluster_centers = kmeans.fit(features).cluster_centers_

        # Find samples closest to cluster centers
        distances = cdist(features, cluster_centers)
        selected_indices = []

        for i in range(n_samples):
            closest_idx = np.argmin(distances[:, i])
            selected_indices.append(closest_idx)
            # Remove selected sample from consideration
            distances[closest_idx, :] = np.inf

        return selected_indices

    def query_by_committee(self, n_samples: int,
                          committee_size: int = 5) -> List[int]:
        """Use ensemble disagreement for sample selection"""

        # Train committee of models with different initializations
        committee = []
        for _ in range(committee_size):
            model_copy = copy.deepcopy(self.model)
            # Reinitialize with different random weights
            self._reinitialize_model(model_copy)

            # Train on current labeled data
            self._train_model(model_copy, self.labeled_data)
            committee.append(model_copy)

        # Compute disagreement for unlabeled samples
        disagreements = []
        unlabeled_loader = torch.utils.data.DataLoader(
            self.unlabeled_data, batch_size=32, shuffle=False
        )

        with torch.no_grad():
            for data, _ in unlabeled_loader:
                data = data.cuda()

                # Get predictions from all committee members
                predictions = []
                for model in committee:
                    model.eval()
                    logits = model(data)
                    probs = torch.softmax(logits, dim=1)
                    predictions.append(probs.cpu().numpy())

                # Compute variance (disagreement) across committee
                predictions = np.array(predictions)
                variance = np.var(predictions, axis=0)
                disagreement = np.mean(variance, axis=1)

                disagreements.extend(disagreement)

        # Select samples with highest disagreement
        disagreement_indices = np.argsort(disagreements)[-n_samples:]
        return disagreement_indices.tolist()

    def active_learning_round(self, strategy: str = 'uncertainty',
                            n_samples: int = 100) -> Dict:
        """Execute one round of active learning"""

        print(f"Active Learning Round {len(self.query_history) + 1}")

        # Select samples based on strategy
        if strategy == 'uncertainty':
            selected_indices = self.uncertainty_sampling(n_samples)
        elif strategy == 'diversity':
            selected_indices = self.diversity_sampling(n_samples)
        elif strategy == 'committee':
            selected_indices = self.query_by_committee(n_samples)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

        # Simulate labeling (in practice, human annotators would label)
        newly_labeled = self._label_samples(selected_indices)

        # Add to labeled dataset
        self.labeled_data.extend(newly_labeled)

        # Remove from unlabeled dataset
        self._remove_samples_from_unlabeled(selected_indices)

        # Retrain model on expanded labeled dataset
        model_performance = self._retrain_model()

        # Record query
        query_info = {
            'round': len(self.query_history) + 1,
            'strategy': strategy,
            'samples_queried': n_samples,
            'total_labeled': len(self.labeled_data),
            'model_performance': model_performance
        }

        self.query_history.append(query_info)
        return query_info
