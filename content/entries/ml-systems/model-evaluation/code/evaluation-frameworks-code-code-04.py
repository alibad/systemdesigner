class MLTestingFramework:
    """
    Comprehensive testing framework for ML systems
    """

    def __init__(self, model, data_pipeline, feature_pipeline):
        self.model = model
        self.data_pipeline = data_pipeline
        self.feature_pipeline = feature_pipeline

    def data_validation_tests(self, data):
        """Test data quality and schema compliance"""
        test_results = {
            'schema_tests': self.validate_schema(data),
            'quality_tests': self.validate_data_quality(data),
            'distribution_tests': self.validate_distribution(data)
        }

        return test_results

    def validate_schema(self, data):
        """Validate data schema and types"""
        expected_schema = {
            'feature_1': 'float64',
            'feature_2': 'int64',
            'feature_3': 'object',
            'target': 'int64'
        }

        schema_tests = {}

        for column, expected_type in expected_schema.items():
            if column in data.columns:
                actual_type = str(data[column].dtype)
                schema_tests[f'{column}_type_check'] = actual_type == expected_type
            else:
                schema_tests[f'{column}_existence_check'] = False

        return schema_tests

    def validate_data_quality(self, data):
        """Test data quality metrics"""
        quality_tests = {}

        for column in data.columns:
            # Missing value tests
            missing_rate = data[column].isnull().sum() / len(data)
            quality_tests[f'{column}_missing_rate'] = missing_rate < 0.05

            # Duplicate tests
            if data[column].dtype in ['object', 'category']:
                unique_rate = data[column].nunique() / len(data)
                quality_tests[f'{column}_unique_rate'] = unique_rate > 0.01

            # Outlier tests for numeric columns
            if data[column].dtype in ['int64', 'float64']:
                q1, q3 = data[column].quantile([0.25, 0.75])
                iqr = q3 - q1
                outlier_count = ((data[column] < (q1 - 1.5 * iqr)) |
                                (data[column] > (q3 + 1.5 * iqr))).sum()
                outlier_rate = outlier_count / len(data)
                quality_tests[f'{column}_outlier_rate'] = outlier_rate < 0.1

        return quality_tests

    def model_invariant_tests(self, model, test_data):
        """Test model behavior invariants"""
        invariant_tests = {}

        # Directional expectation tests
        # Example: increasing feature X should increase prediction
        test_sample = test_data.iloc[0:1].copy()
        original_pred = model.predict(test_sample)[0]

        # Test feature monotonicity
        for feature in ['important_feature_1', 'important_feature_2']:
            if feature in test_sample.columns:
                modified_sample = test_sample.copy()
                modified_sample[feature] *= 1.1  # 10% increase
                new_pred = model.predict(modified_sample)[0]

                # Assuming positive correlation expected
                invariant_tests[f'{feature}_monotonicity'] = new_pred >= original_pred

        # Prediction consistency tests
        # Small input changes should lead to small output changes
        noise_scale = 0.01
        predictions = []
        for _ in range(10):
            noisy_sample = test_sample + np.random.normal(0, noise_scale, test_sample.shape)
            pred = model.predict(noisy_sample)[0]
            predictions.append(pred)

        prediction_std = np.std(predictions)
        invariant_tests['prediction_stability'] = prediction_std < 0.1

        return invariant_tests

    def performance_tests(self, model, test_data, latency_threshold_ms=100):
        """Test model performance requirements"""
        import time

        performance_tests = {}

        # Latency test
        latencies = []
        for _ in range(100):
            start_time = time.time()
            _ = model.predict(test_data.iloc[0:1])
            latency_ms = (time.time() - start_time) * 1000
            latencies.append(latency_ms)

        avg_latency = np.mean(latencies)
        p95_latency = np.percentile(latencies, 95)

        performance_tests['avg_latency_ok'] = avg_latency < latency_threshold_ms
        performance_tests['p95_latency_ok'] = p95_latency < latency_threshold_ms * 2

        # Memory usage test
        import psutil
        import os

        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss / 1024 / 1024  # MB

        # Make batch predictions
        _ = model.predict(test_data.iloc[:1000])

        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = memory_after - memory_before

        performance_tests['memory_usage_ok'] = memory_increase < 100  # MB

        return performance_tests

    def integration_tests(self):
        """Test end-to-end pipeline integration"""
        integration_tests = {}

        # Test data pipeline
        try:
            raw_data = self.data_pipeline.load_data()
            processed_data = self.data_pipeline.preprocess(raw_data)
            integration_tests['data_pipeline'] = len(processed_data) > 0
        except Exception as e:
            integration_tests['data_pipeline'] = False
            integration_tests['data_pipeline_error'] = str(e)

        # Test feature pipeline
        try:
            features = self.feature_pipeline.transform(processed_data)
            integration_tests['feature_pipeline'] = features.shape[1] > 0
        except Exception as e:
            integration_tests['feature_pipeline'] = False
            integration_tests['feature_pipeline_error'] = str(e)

        # Test model prediction
        try:
            predictions = self.model.predict(features)
            integration_tests['model_prediction'] = len(predictions) == len(features)
        except Exception as e:
            integration_tests['model_prediction'] = False
            integration_tests['model_prediction_error'] = str(e)

        return integration_tests
