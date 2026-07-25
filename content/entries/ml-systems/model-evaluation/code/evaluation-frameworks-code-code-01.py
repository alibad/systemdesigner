class OfflineEvaluationFramework:
    """
    Comprehensive offline evaluation for ML models
    Following industry best practices for model validation
    """

    def __init__(self, model, data, task_type='classification'):
        self.model = model
        self.data = data
        self.task_type = task_type
        self.results = {}

    def time_series_split(self, data, n_splits=5):
        """Time-aware splitting for temporal data"""
        from sklearn.model_selection import TimeSeriesSplit

        tscv = TimeSeriesSplit(n_splits=n_splits)
        splits = []

        for train_idx, test_idx in tscv.split(data):
            train_data = data.iloc[train_idx]
            test_data = data.iloc[test_idx]
            splits.append((train_data, test_data))

        return splits

    def stratified_evaluation(self, X, y, cv_folds=5):
        """Stratified cross-validation for imbalanced datasets"""
        from sklearn.model_selection import StratifiedKFold
        from sklearn.metrics import classification_report, confusion_matrix

        skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
        fold_scores = []

        for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]

            # Train model
            self.model.fit(X_train, y_train)

            # Predict and evaluate
            y_pred = self.model.predict(X_val)
            y_proba = self.model.predict_proba(X_val)[:, 1] if hasattr(self.model, 'predict_proba') else None

            fold_result = {
                'fold': fold,
                'accuracy': accuracy_score(y_val, y_pred),
                'precision': precision_score(y_val, y_pred, average='weighted'),
                'recall': recall_score(y_val, y_pred, average='weighted'),
                'f1': f1_score(y_val, y_pred, average='weighted'),
                'auc': roc_auc_score(y_val, y_proba) if y_proba is not None else None,
                'confusion_matrix': confusion_matrix(y_val, y_pred).tolist()
            }

            fold_scores.append(fold_result)

        return fold_scores

    def regression_evaluation(self, X, y, cv_folds=5):
        """Comprehensive regression model evaluation"""
        from sklearn.model_selection import KFold
        from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

        kf = KFold(n_splits=cv_folds, shuffle=True, random_state=42)
        fold_scores = []

        for fold, (train_idx, val_idx) in enumerate(kf.split(X)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]

            self.model.fit(X_train, y_train)
            y_pred = self.model.predict(X_val)

            fold_result = {
                'fold': fold,
                'rmse': np.sqrt(mean_squared_error(y_val, y_pred)),
                'mae': mean_absolute_error(y_val, y_pred),
                'r2': r2_score(y_val, y_pred),
                'mape': np.mean(np.abs((y_val - y_pred) / y_val)) * 100,
                'residuals': (y_val - y_pred).tolist()
            }

            fold_scores.append(fold_result)

        return fold_scores

    def statistical_significance_test(self, model1_scores, model2_scores, alpha=0.05):
        """Compare two models using statistical tests"""
        from scipy import stats

        # Paired t-test for model comparison
        t_stat, p_value = stats.ttest_rel(model1_scores, model2_scores)

        result = {
            'test': 'Paired t-test',
            't_statistic': t_stat,
            'p_value': p_value,
            'significant': p_value < alpha,
            'alpha': alpha,
            'interpretation': f"Model 1 {'significantly' if p_value < alpha else 'not significantly'} different from Model 2"
        }

        return result
