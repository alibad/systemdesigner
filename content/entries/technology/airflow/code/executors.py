# airflow.cfg configuration for different executors

# Sequential Executor (development)
[core]
executor = SequentialExecutor

# Local Executor (single machine)
[core]
executor = LocalExecutor
[local]
parallelism = 8

# Celery Executor (distributed)
[core]
executor = CeleryExecutor
[celery]
broker_url = redis://redis:6379/0
result_backend = db+postgresql://user:pass@postgres:5432/airflow
worker_concurrency = 4

# Kubernetes Executor (cloud native)
[core]
executor = KubernetesExecutor
[kubernetes]
namespace = airflow
worker_container_repository = apache/airflow
worker_container_tag = 2.5.1
delete_worker_pods = True