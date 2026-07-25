class MetricsFramework:
    """
    Comprehensive metrics evaluation for different ML tasks
    """

    def classification_metrics(self, y_true, y_pred, y_proba=None):
        """Complete classification evaluation metrics"""
        from sklearn.metrics import (
            accuracy_score, precision_score, recall_score, f1_score,
            roc_auc_score, average_precision_score, confusion_matrix,
            classification_report, cohen_kappa_score
        )

        metrics = {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision_macro': precision_score(y_true, y_pred, average='macro'),
            'recall_macro': recall_score(y_true, y_pred, average='macro'),
            'f1_macro': f1_score(y_true, y_pred, average='macro'),
            'precision_weighted': precision_score(y_true, y_pred, average='weighted'),
            'recall_weighted': recall_score(y_true, y_pred, average='weighted'),
            'f1_weighted': f1_score(y_true, y_pred, average='weighted'),
            'cohen_kappa': cohen_kappa_score(y_true, y_pred),
            'confusion_matrix': confusion_matrix(y_true, y_pred).tolist()
        }

        if y_proba is not None:
            metrics.update({
                'auc_roc': roc_auc_score(y_true, y_proba),
                'auc_pr': average_precision_score(y_true, y_proba)
            })

        # Per-class metrics
        class_report = classification_report(y_true, y_pred, output_dict=True)
        metrics['per_class_metrics'] = class_report

        return metrics

    def regression_metrics(self, y_true, y_pred):
        """Comprehensive regression evaluation"""
        from sklearn.metrics import (
            mean_squared_error, mean_absolute_error, r2_score,
            explained_variance_score, max_error
        )

        mse = mean_squared_error(y_true, y_pred)
        mae = mean_absolute_error(y_true, y_pred)

        metrics = {
            'mse': mse,
            'rmse': np.sqrt(mse),
            'mae': mae,
            'r2': r2_score(y_true, y_pred),
            'explained_variance': explained_variance_score(y_true, y_pred),
            'max_error': max_error(y_true, y_pred),
            'mape': np.mean(np.abs((y_true - y_pred) / y_true)) * 100,
            'median_absolute_error': np.median(np.abs(y_true - y_pred))
        }

        return metrics

    def ranking_metrics(self, y_true, y_scores, k_values=[1, 5, 10]):
        """Information retrieval and ranking metrics"""
        def dcg_at_k(relevance_scores, k):
            """Discounted Cumulative Gain at k"""
            relevance_scores = np.array(relevance_scores)[:k]
            if relevance_scores.size:
                return np.sum(relevance_scores / np.log2(np.arange(2, relevance_scores.size + 2)))
            return 0

        def ndcg_at_k(y_true, y_scores, k):
            """Normalized DCG at k"""
            # Sort by predicted scores
            sorted_indices = np.argsort(y_scores)[::-1]
            sorted_relevance = y_true[sorted_indices]

            dcg = dcg_at_k(sorted_relevance, k)
            idcg = dcg_at_k(sorted(y_true, reverse=True), k)

            return dcg / idcg if idcg > 0 else 0

        metrics = {}

        for k in k_values:
            # Top-k accuracy
            top_k_indices = np.argsort(y_scores)[::-1][:k]
            top_k_accuracy = np.any(y_true[top_k_indices] == 1)

            metrics[f'top_{k}_accuracy'] = top_k_accuracy
            metrics[f'ndcg_at_{k}'] = ndcg_at_k(y_true, y_scores, k)

        return metrics

    def fairness_metrics(self, y_true, y_pred, sensitive_attribute):
        """Bias and fairness evaluation metrics"""
        from collections import defaultdict

        fairness_metrics = defaultdict(dict)
        unique_groups = np.unique(sensitive_attribute)

        for group in unique_groups:
            group_mask = sensitive_attribute == group
            group_y_true = y_true[group_mask]
            group_y_pred = y_pred[group_mask]

            # Accuracy by group
            group_accuracy = accuracy_score(group_y_true, group_y_pred)
            fairness_metrics[f'group_{group}']['accuracy'] = group_accuracy

            # Positive prediction rate
            positive_rate = np.mean(group_y_pred)
            fairness_metrics[f'group_{group}']['positive_prediction_rate'] = positive_rate

            # True positive rate (recall)
            if np.sum(group_y_true) > 0:
                tpr = recall_score(group_y_true, group_y_pred)
                fairness_metrics[f'group_{group}']['true_positive_rate'] = tpr

        # Calculate fairness metrics
        accuracies = [fairness_metrics[f'group_{g}']['accuracy'] for g in unique_groups]
        fairness_metrics['equality_of_opportunity'] = min(accuracies) / max(accuracies)

        return dict(fairness_metrics)

    def business_metrics_alignment(self, model_predictions, business_outcomes):
        """Align ML metrics with business KPIs"""
        alignment_analysis = {
            'revenue_correlation': np.corrcoef(model_predictions, business_outcomes['revenue'])[0,1],
            'conversion_lift': {
                'baseline_conversion': np.mean(business_outcomes['conversions']),
                'model_driven_conversion': np.mean(business_outcomes['conversions'][model_predictions > 0.5]),
                'lift_percentage': ((np.mean(business_outcomes['conversions'][model_predictions > 0.5]) /
                                   np.mean(business_outcomes['conversions'])) - 1) * 100
            },
            'cost_per_acquisition': {
                'with_model': business_outcomes['marketing_spend'] / np.sum(business_outcomes['acquisitions']),
                'improvement': 'calculated based on precision improvements'
            }
        }

        return alignment_analysis
