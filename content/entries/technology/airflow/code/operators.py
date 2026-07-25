from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.operators.email import EmailOperator
from airflow.providers.amazon.aws.operators.s3 import S3FileTransformOperator

# Python function execution
validate_data = PythonOperator(
    task_id='validate_data',
    python_callable=run_data_validation,
    op_kwargs={'table': 'users', 'checks': ['null_check', 'duplicate_check']},
    dag=dag
)

# Shell command execution
process_files = BashOperator(
    task_id='process_files',
    bash_command='python /scripts/process_data.py --date {{ ds }}',
    dag=dag
)

# Cloud service integration
transform_s3_file = S3FileTransformOperator(
    task_id='transform_s3_file',
    source_s3_key='raw/data-{{ ds }}.csv',
    dest_s3_key='processed/data-{{ ds }}.parquet',
    transform_script='/scripts/csv_to_parquet.py',
    dag=dag
)