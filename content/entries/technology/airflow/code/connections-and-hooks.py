from airflow.hooks.postgres_hook import PostgresHook
from airflow.providers.amazon.aws.hooks.s3 import S3Hook
from airflow.models import Connection

def extract_postgres_data(**context):
    # Using connection defined in Airflow UI
    pg_hook = PostgresHook(postgres_conn_id='warehouse_db')

    sql = """
    SELECT customer_id, order_total, order_date
    FROM orders
    WHERE order_date = %s
    """

    df = pg_hook.get_pandas_df(sql, parameters=[context['ds']])
    return df.to_json()

def upload_to_s3(**context):
    s3_hook = S3Hook(aws_conn_id='aws_default')

    data = context['task_instance'].xcom_pull(task_ids='extract_postgres_data')

    s3_hook.load_string(
        string_data=data,
        key=f"processed/orders_{context['ds']}.json",
        bucket_name='data-lake',
        replace=True
    )