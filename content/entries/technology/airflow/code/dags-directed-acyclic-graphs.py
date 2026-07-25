from datetime import timedelta

import pendulum
from airflow.sdk import DAG, task


@task(retries=2, retry_delay=timedelta(minutes=5), retry_exponential_backoff=True)
def extract(window_start: str, window_end: str) -> str:
    """Write the source window to durable storage and return only its URI."""
    return export_orders(window_start=window_start, window_end=window_end)


@task
def validate(source_uri: str) -> str:
    assert_partition_is_complete(source_uri)
    return source_uri


@task
def load(source_uri: str, partition_key: str) -> None:
    # The partition key makes a retry or backfill replace the same logical output.
    merge_orders_partition(source_uri=source_uri, partition_key=partition_key)


with DAG(
    dag_id="daily_orders",
    schedule="@daily",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    max_active_runs=2,
    tags=["orders", "production"],
):
    source = extract(
        window_start="{{ data_interval_start }}",
        window_end="{{ data_interval_end }}",
    )
    checked = validate(source)
    load(checked, partition_key="{{ data_interval_start | ds }}")
