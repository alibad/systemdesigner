from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as sum_, to_date


spark = (
    SparkSession.builder
    .appName("daily-sales-etl")
    .config("spark.sql.adaptive.enabled", "true")
    .getOrCreate()
)

source = "s3://example-analytics-raw/sales/ingest_date=2026-07-22/"
destination = "s3://example-analytics-curated/sales/run_id=2026-07-22/"

sales = (
    spark.read
    .schema("order_id STRING, event_time TIMESTAMP, category STRING, amount DECIMAL(18,2)")
    .parquet(source)
)

daily_totals = (
    sales
    .filter(col("amount") > 0)
    .withColumn("event_date", to_date("event_time"))
    .groupBy("event_date", "category")
    .agg(sum_("amount").alias("gross_sales"))
)

(
    daily_totals.write
    .mode("errorifexists")
    .partitionBy("event_date")
    .parquet(destination)
)

spark.stop()
