class OnlineEvaluationFramework:
    """
    Online evaluation and testing for production ML models
    """

    def __init__(self, model_registry, traffic_splitter, metrics_collector):
        self.model_registry = model_registry
        self.traffic_splitter = traffic_splitter
        self.metrics_collector = metrics_collector

    def ab_test_setup(self, control_model, treatment_model, traffic_split=0.1):
        """Set up A/B test between two models"""
        test_config = {
            'test_id': f"ab_test_{int(time.time())}",
            'control_model': {
                'name': control_model.name,
                'version': control_model.version,
                'traffic_percentage': 100 - (traffic_split * 100)
            },
            'treatment_model': {
                'name': treatment_model.name,
                'version': treatment_model.version,
                'traffic_percentage': traffic_split * 100
            },
            'metrics': [
                'accuracy', 'latency', 'throughput',
                'business_kpi', 'user_satisfaction'
            ],
            'duration_days': 14,
            'minimum_sample_size': 10000
        }

        return test_config

    def shadow_mode_evaluation(self, shadow_model, primary_model):
        """Run shadow model alongside primary for comparison"""
        class ShadowEvaluator:
            def __init__(self, shadow_model, primary_model):
                self.shadow_model = shadow_model
                self.primary_model = primary_model
                self.comparison_data = []

            async def process_request(self, input_data):
                start_time = time.time()

                # Primary model prediction (serves user)
                primary_pred = await self.primary_model.predict(input_data)
                primary_latency = time.time() - start_time

                # Shadow model prediction (logged only)
                shadow_start = time.time()
                shadow_pred = await self.shadow_model.predict(input_data)
                shadow_latency = time.time() - shadow_start

                # Log comparison data
                comparison = {
                    'timestamp': datetime.utcnow(),
                    'primary_prediction': primary_pred,
                    'shadow_prediction': shadow_pred,
                    'primary_latency': primary_latency,
                    'shadow_latency': shadow_latency,
                    'prediction_diff': abs(primary_pred - shadow_pred),
                    'input_hash': hash(str(input_data))
                }

                self.comparison_data.append(comparison)
                return primary_pred

        return ShadowEvaluator(shadow_model, primary_model)

    def canary_deployment(self, new_model, canary_percentage=5):
        """Gradual rollout with monitoring"""
        deployment_config = {
            'canary_model': new_model,
            'initial_traffic': canary_percentage,
            'rollout_stages': [5, 10, 25, 50, 100],
            'success_criteria': {
                'error_rate_threshold': 0.01,
                'latency_p95_threshold': 100,  # ms
                'business_metric_drop_threshold': 0.05
            },
            'rollback_triggers': [
                'error_rate > 0.02',
                'latency_p95 > 200ms',
                'business_metric_drop > 0.1'
            ]
        }

        return deployment_config

    def real_time_monitoring(self):
        """Real-time model performance monitoring"""
        monitoring_pipeline = {
            'data_quality_checks': {
                'feature_drift': 'KL divergence > 0.1',
                'missing_values': 'missing_rate > 0.05',
                'outliers': 'outlier_rate > 0.1',
                'schema_validation': 'feature_count_match'
            },
            'model_performance': {
                'accuracy_degradation': 'accuracy_drop > 0.05',
                'prediction_drift': 'prediction_distribution_shift',
                'confidence_scores': 'low_confidence_rate > 0.2',
                'bias_detection': 'fairness_metrics'
            },
            'system_metrics': {
                'latency': 'p95 < 100ms',
                'throughput': 'qps > 1000',
                'error_rate': 'error_rate < 0.01',
                'resource_usage': 'cpu < 80%, memory < 80%'
            },
            'business_metrics': {
                'conversion_rate': 'conversion_drop < 0.05',
                'user_engagement': 'engagement_drop < 0.1',
                'revenue_impact': 'revenue_change'
            }
        }

        return monitoring_pipeline
