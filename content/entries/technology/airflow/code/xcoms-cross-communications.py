from airflow.operators.python import PythonOperator

def extract_and_count(**context):
    # Extract data and return count (automatically stored in XCom)
    data = fetch_daily_data(context['ds'])
    row_count = len(data)

    # Manual XCom push for additional metadata
    context['task_instance'].xcom_push(
        key='data_quality',
        value={'rows': row_count, 'columns': len(data.columns)}
    )

    return row_count  # Auto-pushed to XCom

def conditional_processing(**context):
    # Pull data from upstream task
    row_count = context['task_instance'].xcom_pull(
        task_ids='extract_and_count'
    )

    # Pull custom metadata
    data_quality = context['task_instance'].xcom_pull(
        task_ids='extract_and_count',
        key='data_quality'
    )

    if row_count > 10000:
        return "trigger_batch_processing"
    else:
        return "trigger_real_time_processing"

extract_task = PythonOperator(
    task_id='extract_and_count',
    python_callable=extract_and_count,
    dag=dag
)

process_task = PythonOperator(
    task_id='conditional_processing',
    python_callable=conditional_processing,
    dag=dag
)