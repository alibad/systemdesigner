# Serverless LLM with AWS Lambda and API Gateway
import json
import boto3
import os
from typing import Dict, Any
import time
import logging

# AWS Lambda Handler
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda function for LLM inference
    """
    try:
        # Parse request
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event

        # Initialize service (with caching for warm starts)
        service = get_or_create_service()

        # Process request
        result = service.process_request(body)

        # Return response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }

    except Exception as e:
        logging.error(f"Error processing request: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

# Global service instance for warm starts
_service_instance = None

def get_or_create_service():
    """Get or create service instance for warm starts"""
    global _service_instance

    if _service_instance is None:
        _service_instance = ServerlessLLMService()
        _service_instance.initialize()

    return _service_instance

class ServerlessLLMService:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.s3_client = boto3.client('s3')
        self.model_bucket = os.environ.get('MODEL_BUCKET', 'llm-models')
        self.model_key = os.environ.get('MODEL_KEY', 'optimized-model.tar.gz')

    def initialize(self):
        """Initialize model (cached for warm starts)"""
        if self.model is not None:
            return  # Already initialized

        start_time = time.time()

        # Download model from S3 if not cached
        model_path = self._download_model_if_needed()

        # Load model
        self.model, self.tokenizer = self._load_model(model_path)

        init_time = time.time() - start_time
        logging.info(f"Model initialized in {init_time:.2f}s")

    def _download_model_if_needed(self) -> str:
        """Download model from S3 if not already cached"""
        local_path = '/tmp/model'

        # Check if model already exists (warm start)
        if os.path.exists(local_path):
            return local_path

        # Download from S3
        try:
            self.s3_client.download_file(
                self.model_bucket,
                self.model_key,
                f'{local_path}.tar.gz'
            )

            # Extract model
            import tarfile
            with tarfile.open(f'{local_path}.tar.gz', 'r:gz') as tar:
                tar.extractall('/tmp/')

            return local_path

        except Exception as e:
            logging.error(f"Failed to download model: {e}")
            raise

    def _load_model(self, model_path: str):
        """Load model and tokenizer"""
        # Use lightweight inference library for serverless
        import onnxruntime as ort
        from transformers import AutoTokenizer

        # Load ONNX model for fast inference
        session = ort.InferenceSession(
            f"{model_path}/model.onnx",
            providers=['CPUExecutionProvider']
        )

        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_path)

        return session, tokenizer

    def process_request(self, request: Dict) -> Dict:
        """Process inference request"""
        start_time = time.time()

        prompt = request.get('prompt', '')
        max_tokens = request.get('max_tokens', 100)
        temperature = request.get('temperature', 0.7)

        # Tokenize input
        inputs = self.tokenizer(
            prompt,
            return_tensors='np',
            padding=True,
            truncation=True,
            max_length=512
        )

        # Run inference
        outputs = self.model.run(None, {
            'input_ids': inputs['input_ids'],
            'attention_mask': inputs['attention_mask']
        })

        # Decode output
        generated_ids = outputs[0]
        generated_text = self.tokenizer.decode(
            generated_ids[0],
            skip_special_tokens=True
        )

        inference_time = time.time() - start_time

        return {
            'generated_text': generated_text,
            'inference_time_ms': inference_time * 1000,
            'model_version': '1.0.0'
        }

# Serverless Framework Configuration (serverless.yml)
serverless_config = """
service: llm-inference

provider:
  name: aws
  runtime: python3.9
  region: us-east-1
  timeout: 30
  memorySize: 3008
  environment:
    MODEL_BUCKET: ${env:MODEL_BUCKET}
    MODEL_KEY: ${env:MODEL_KEY}
  iamRoleStatements:
    - Effect: Allow
      Action:
        - s3:GetObject
      Resource: arn:aws:s3:::${env:MODEL_BUCKET}/*

functions:
  inference:
    handler: handler.lambda_handler
    events:
      - http:
          path: inference
          method: post
          cors: true
    reservedConcurrency: 10  # Limit concurrent executions

  batch_inference:
    handler: batch_handler.lambda_handler
    timeout: 900  # 15 minutes for batch processing
    memorySize: 10240  # 10GB for large batches
    events:
      - s3:
          bucket: ${env:INPUT_BUCKET}
          event: s3:ObjectCreated:*
          rules:
            - prefix: batch-requests/
            - suffix: .json

plugins:
  - serverless-python-requirements
  - serverless-plugin-warmup

custom:
  pythonRequirements:
    dockerizePip: true
    zip: true
    slim: true
  warmup:
    enabled: true
    prewarm: true
    concurrency: 2
"""

# Batch Processing Handler
def batch_lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle batch inference requests from S3"""

    s3_client = boto3.client('s3')

    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']

        # Download batch request
        response = s3_client.get_object(Bucket=bucket, Key=key)
        batch_request = json.loads(response['Body'].read())

        # Process batch
        service = get_or_create_service()
        results = []

        for request in batch_request['requests']:
            result = service.process_request(request)
            results.append(result)

        # Upload results
        output_key = key.replace('batch-requests/', 'batch-results/')
        s3_client.put_object(
            Bucket=bucket,
            Key=output_key,
            Body=json.dumps({
                'request_id': batch_request['request_id'],
                'results': results,
                'timestamp': time.time()
            })
        )

    return {'statusCode': 200}

# Auto-scaling Configuration with CloudFormation
cloudformation_template = {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Resources": {
        "LLMInferenceFunction": {
            "Type": "AWS::Lambda::Function",
            "Properties": {
                "Runtime": "python3.9",
                "Handler": "handler.lambda_handler",
                "MemorySize": 3008,
                "Timeout": 30,
                "ReservedConcurrencyLimit": 50,
                "ProvisionedConcurrencyConfig": {
                    "ProvisionedConcurrencyLevel": 5  # Keep 5 instances warm
                }
            }
        },
        "APIGateway": {
            "Type": "AWS::ApiGateway::RestApi",
            "Properties": {
                "Name": "LLM-Inference-API",
                "Description": "API for LLM inference"
            }
        },
        "CloudWatchAlarm": {
            "Type": "AWS::CloudWatch::Alarm",
            "Properties": {
                "AlarmName": "LLM-High-Error-Rate",
                "MetricName": "Errors",
                "Namespace": "AWS/Lambda",
                "Statistic": "Sum",
                "Period": 300,
                "EvaluationPeriods": 2,
                "Threshold": 10,
                "ComparisonOperator": "GreaterThanThreshold"
            }
        }
    }
}

# Cost Optimization Helper
class ServerlessCostOptimizer:
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')

    def analyze_usage_patterns(self, function_name: str, days: int = 30) -> Dict:
        """Analyze function usage patterns for optimization"""

        # Get metrics from CloudWatch
        metrics = self.cloudwatch.get_metric_statistics(
            Namespace='AWS/Lambda',
            MetricName='Invocations',
            Dimensions=[{'Name': 'FunctionName', 'Value': function_name}],
            StartTime=time.time() - (days * 24 * 3600),
            EndTime=time.time(),
            Period=3600,
            Statistics=['Sum']
        )

        # Analyze patterns
        hourly_invocations = [point['Sum'] for point in metrics['Datapoints']]

        return {
            'avg_hourly_invocations': sum(hourly_invocations) / len(hourly_invocations),
            'peak_invocations': max(hourly_invocations),
            'recommended_provisioned_concurrency': max(1, int(max(hourly_invocations) * 0.8)),
            'cost_optimization_suggestions': self._generate_suggestions(hourly_invocations)
        }

    def _generate_suggestions(self, hourly_invocations: list) -> list:
        """Generate cost optimization suggestions"""
        suggestions = []

        avg_invocations = sum(hourly_invocations) / len(hourly_invocations)

        if avg_invocations < 10:
            suggestions.append("Consider using on-demand only (no provisioned concurrency)")
        elif avg_invocations > 100:
            suggestions.append("Consider dedicated instances or containers for consistent load")

        return suggestions

# Usage Example
if __name__ == "__main__":
    # This would be deployed using Serverless Framework or AWS SAM
    print("Deploy with: serverless deploy")
    print("Test with: curl -X POST https://api-url/inference -d '{\"prompt\": \"Hello world\"}'")
