from airflow.sensors.filesystem import FileSensor
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor
from airflow.providers.postgres.sensors.postgres import PostgresSqlSensor
from airflow.sensors.base import BaseSensorOperator

# File system monitoring
wait_for_file = FileSensor(
    task_id='wait_for_daily_file',
    filepath='/data/daily_sales_{{ ds }}.csv',
    poke_interval=300,  # Check every 5 minutes
    timeout=3600,  # Give up after 1 hour
    dag=dag
)

# S3 object availability
wait_for_s3_object = S3KeySensor(
    task_id='wait_for_s3_data',
    bucket_name='data-lake',
    bucket_key='raw/transactions/date={{ ds }}/data.parquet',
    aws_conn_id='aws_default',
    poke_interval=600,
    timeout=7200,
    dag=dag
)

# Database condition check
wait_for_data_quality = PostgresSqlSensor(
    task_id='wait_for_quality_check',
    sql="SELECT COUNT(*) FROM data_quality_checks WHERE date='{{ ds }}' AND status='PASSED'",
    conn_id='postgres_default',
    dag=dag
)