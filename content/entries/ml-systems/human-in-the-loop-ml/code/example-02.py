import numpy as np
import torch
import torch.nn as nn
from sklearn.ensemble import RandomForestClassifier
from scipy.stats import entropy
from typing import List, Tuple, Dict, Any

class ActiveLearningSystem:
    def __init__(self, base_model, uncertainty_method='entropy'):
        self.base_model = base_model
        self.uncertainty_method = uncertainty_method
        self.labeled_data = []
        self.unlabeled_data = []
        self.uncertainty_threshold = 0.7

    def uncertainty_sampling(self, X_unlabeled: np.ndarray, n_samples: int = 100) -> List[int]:
        """Select most uncertain samples for human annotation"""

        # Get model predictions
        predictions = self.base_model.predict_proba(X_unlabeled)

        # Calculate uncertainty scores
        if self.uncertainty_method == 'entropy':
            uncertainties = self._entropy_uncertainty(predictions)
        elif self.uncertainty_method == 'least_confident':
            uncertainties = self._least_confident_uncertainty(predictions)
        elif self.uncertainty_method == 'margin':
            uncertainties = self._margin_uncertainty(predictions)
        else:
            raise ValueError(f"Unknown uncertainty method: {self.uncertainty_method}")

        # Select top uncertain samples
        uncertain_indices = np.argsort(uncertainties)[-n_samples:]

        return uncertain_indices.tolist()

    def _entropy_uncertainty(self, predictions: np.ndarray) -> np.ndarray:
        """Calculate entropy-based uncertainty"""
        # Add small epsilon to avoid log(0)
        epsilon = 1e-10
        predictions = np.clip(predictions, epsilon, 1 - epsilon)

        # Calculate entropy for each sample
        entropies = -np.sum(predictions * np.log(predictions), axis=1)

        return entropies

    def _least_confident_uncertainty(self, predictions: np.ndarray) -> np.ndarray:
        """Calculate least confident uncertainty"""
        # Uncertainty = 1 - max(prediction)
        max_probs = np.max(predictions, axis=1)
        uncertainties = 1 - max_probs

        return uncertainties

    def _margin_uncertainty(self, predictions: np.ndarray) -> np.ndarray:
        """Calculate margin-based uncertainty"""
        # Sort predictions in descending order
        sorted_preds = np.sort(predictions, axis=1)[:, ::-1]

        # Margin = difference between top two predictions
        margins = sorted_preds[:, 0] - sorted_preds[:, 1]
        uncertainties = 1 - margins

        return uncertainties

    def diversity_sampling(self, X_unlabeled: np.ndarray, n_samples: int = 100) -> List[int]:
        """Select diverse samples to ensure good coverage"""
        from sklearn.cluster import KMeans

        # Cluster unlabeled data
        n_clusters = min(n_samples, len(X_unlabeled))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = kmeans.fit_predict(X_unlabeled)

        # Select one sample from each cluster (closest to centroid)
        selected_indices = []
        for cluster_id in range(n_clusters):
            cluster_indices = np.where(cluster_labels == cluster_id)[0]
            if len(cluster_indices) > 0:
                # Find sample closest to cluster centroid
                cluster_center = kmeans.cluster_centers_[cluster_id]
                distances = np.linalg.norm(
                    X_unlabeled[cluster_indices] - cluster_center, axis=1
                )
                closest_idx = cluster_indices[np.argmin(distances)]
                selected_indices.append(closest_idx)

        return selected_indices

    def query_by_committee(self, X_unlabeled: np.ndarray,
                          committee_models: List[Any],
                          n_samples: int = 100) -> List[int]:
        """Query by committee - select samples with highest disagreement"""

        # Get predictions from all committee members
        committee_predictions = []
        for model in committee_models:
            preds = model.predict_proba(X_unlabeled)
            committee_predictions.append(preds)

        # Calculate disagreement (KL divergence)
        disagreements = []
        for i in range(len(X_unlabeled)):
            sample_preds = [pred[i] for pred in committee_predictions]
            avg_pred = np.mean(sample_preds, axis=0)

            # Calculate average KL divergence from committee average
            kl_divs = []
            for pred in sample_preds:
                kl_div = entropy(pred, avg_pred)
                kl_divs.append(kl_div)

            disagreements.append(np.mean(kl_divs))

        # Select samples with highest disagreement
        disagreement_indices = np.argsort(disagreements)[-n_samples:]

        return disagreement_indices.tolist()

    def adaptive_sampling(self, X_unlabeled: np.ndarray,
                         n_samples: int = 100,
                         uncertainty_weight: float = 0.7,
                         diversity_weight: float = 0.3) -> List[int]:
        """Combine uncertainty and diversity sampling"""

        # Get uncertainty scores
        predictions = self.base_model.predict_proba(X_unlabeled)
        uncertainty_scores = self._entropy_uncertainty(predictions)

        # Normalize uncertainty scores
        uncertainty_scores = (uncertainty_scores - uncertainty_scores.min()) / (
            uncertainty_scores.max() - uncertainty_scores.min()
        )

        # Get diversity scores (distance from labeled data)
        diversity_scores = self._calculate_diversity_scores(X_unlabeled)

        # Combine scores
        combined_scores = (
            uncertainty_weight * uncertainty_scores +
            diversity_weight * diversity_scores
        )

        # Select top samples
        selected_indices = np.argsort(combined_scores)[-n_samples:]

        return selected_indices.tolist()

    def _calculate_diversity_scores(self, X_unlabeled: np.ndarray) -> np.ndarray:
        """Calculate diversity scores based on distance from labeled data"""
        if not self.labeled_data:
            # If no labeled data, return uniform scores
            return np.ones(len(X_unlabeled))

        # Calculate minimum distance to labeled data for each unlabeled sample
        labeled_features = np.array([sample['features'] for sample in self.labeled_data])

        diversity_scores = []
        for unlabeled_sample in X_unlabeled:
            # Calculate distances to all labeled samples
            distances = np.linalg.norm(labeled_features - unlabeled_sample, axis=1)
            min_distance = np.min(distances)
            diversity_scores.append(min_distance)

        # Normalize scores
        diversity_scores = np.array(diversity_scores)
        diversity_scores = (diversity_scores - diversity_scores.min()) / (
            diversity_scores.max() - diversity_scores.min() + 1e-8
        )

        return diversity_scores

    def update_model_with_feedback(self,
                                 new_labels: List[Tuple[np.ndarray, int]],
                                 retrain: bool = True):
        """Update model with new human-labeled data"""

        # Add new labels to labeled dataset
        for features, label in new_labels:
            self.labeled_data.append({
                'features': features,
                'label': label,
                'timestamp': np.datetime64('now')
            })

        if retrain and len(self.labeled_data) > 10:
            # Retrain model with updated dataset
            X_train = np.array([sample['features'] for sample in self.labeled_data])
            y_train = np.array([sample['label'] for sample in self.labeled_data])

            self.base_model.fit(X_train, y_train)

            print(f"Model retrained with {len(self.labeled_data)} labeled samples")

    def get_annotation_suggestions(self,
                                 X_unlabeled: np.ndarray,
                                 n_suggestions: int = 10,
                                 strategy: str = 'adaptive') -> Dict[str, Any]:
        """Get suggestions for human annotation"""

        if strategy == 'uncertainty':
            indices = self.uncertainty_sampling(X_unlabeled, n_suggestions)
        elif strategy == 'diversity':
            indices = self.diversity_sampling(X_unlabeled, n_suggestions)
        elif strategy == 'adaptive':
            indices = self.adaptive_sampling(X_unlabeled, n_suggestions)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")

        # Get predictions and uncertainty scores for selected samples
        selected_samples = X_unlabeled[indices]
        predictions = self.base_model.predict_proba(selected_samples)
        uncertainty_scores = self._entropy_uncertainty(predictions)

        suggestions = []
        for i, idx in enumerate(indices):
            suggestions.append({
                'index': idx,
                'features': X_unlabeled[idx],
                'predicted_class': np.argmax(predictions[i]),
                'prediction_confidence': np.max(predictions[i]),
                'uncertainty_score': uncertainty_scores[i],
                'suggested_priority': len(indices) - i  # Higher priority for more uncertain
            })

        return {
            'suggestions': suggestions,
            'strategy_used': strategy,
            'total_unlabeled': len(X_unlabeled),
            'annotation_efficiency': len(indices) / len(X_unlabeled)
        }

class HumanFeedbackLoop:
    """System for collecting and integrating human feedback"""

    def __init__(self, model, feedback_buffer_size=1000):
        self.model = model
        self.feedback_buffer = []
        self.feedback_buffer_size = feedback_buffer_size
        self.feedback_weights = {'positive': 1.0, 'negative': 2.0, 'correction': 3.0}

    def collect_feedback(self,
                        prediction_id: str,
                        true_label: int,
                        feedback_type: str,
                        confidence: float = 1.0):
        """Collect human feedback on model predictions"""

        feedback_entry = {
            'prediction_id': prediction_id,
            'true_label': true_label,
            'feedback_type': feedback_type,  # 'positive', 'negative', 'correction'
            'confidence': confidence,
            'timestamp': np.datetime64('now'),
            'weight': self.feedback_weights.get(feedback_type, 1.0)
        }

        self.feedback_buffer.append(feedback_entry)

        # Maintain buffer size
        if len(self.feedback_buffer) > self.feedback_buffer_size:
            self.feedback_buffer.pop(0)

        # Apply immediate updates for critical feedback
        if feedback_type == 'correction' and confidence > 0.8:
            self._apply_immediate_correction(feedback_entry)

    def _apply_immediate_correction(self, feedback: Dict[str, Any]):
        """Apply immediate model correction for high-confidence feedback"""
        # This would involve immediate model updates
        # Implementation depends on the specific model type
        pass

    def process_feedback_batch(self, batch_size: int = 100):
        """Process a batch of feedback for model improvement"""
        if len(self.feedback_buffer) < batch_size:
            return

        # Select recent feedback
        recent_feedback = self.feedback_buffer[-batch_size:]

        # Group feedback by type
        corrections = [f for f in recent_feedback if f['feedback_type'] == 'correction']
        negative_feedback = [f for f in recent_feedback if f['feedback_type'] == 'negative']

        # Process corrections (highest priority)
        if corrections:
            self._process_corrections(corrections)

        # Process negative feedback for model adjustment
        if negative_feedback:
            self._process_negative_feedback(negative_feedback)

    def _process_corrections(self, corrections: List[Dict[str, Any]]):
        """Process correction feedback to improve model"""
        # Extract features and corrected labels
        corrected_samples = []
        for correction in corrections:
            # Retrieve original prediction data
            prediction_data = self._get_prediction_data(correction['prediction_id'])
            if prediction_data:
                corrected_samples.append({
                    'features': prediction_data['features'],
                    'true_label': correction['true_label'],
                    'weight': correction['weight'] * correction['confidence']
                })

        if corrected_samples:
            # Update model with corrected samples
            self._update_model_with_corrections(corrected_samples)

    def get_feedback_analytics(self) -> Dict[str, Any]:
        """Analyze feedback patterns and model performance"""
        if not self.feedback_buffer:
            return {}

        feedback_types = {}
        confidence_scores = []
        recent_feedback = self.feedback_buffer[-100:]  # Last 100 feedback items

        for feedback in recent_feedback:
            feedback_type = feedback['feedback_type']
            feedback_types[feedback_type] = feedback_types.get(feedback_type, 0) + 1
            confidence_scores.append(feedback['confidence'])

        return {
            'total_feedback': len(self.feedback_buffer),
            'feedback_distribution': feedback_types,
            'average_confidence': np.mean(confidence_scores),
            'correction_rate': feedback_types.get('correction', 0) / len(recent_feedback),
            'model_improvement_opportunity': feedback_types.get('negative', 0) / len(recent_feedback)
        }
