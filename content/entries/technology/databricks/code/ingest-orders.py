from pyspark.sql import functions as F
from pyspark.sql.types import (
    DecimalType,
    LongType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)


ORDER_SCHEMA = StructType(
    [
        StructField("order_id", StringType(), nullable=False),
        StructField("customer_id", StringType(), nullable=False),
        StructField("status", StringType(), nullable=False),
        StructField("amount", DecimalType(18, 2), nullable=False),
        StructField("updated_at", TimestampType(), nullable=False),
        StructField("source_sequence", LongType(), nullable=False),
    ]
)

SOURCE_PATH = "s3://company-landing/orders/"
CHECKPOINT_PATH = "/Volumes/production/ops/checkpoints/orders_bronze"
TARGET_TABLE = "production.bronze.orders"

orders = (
    spark.readStream.format("cloudFiles")
    .option("cloudFiles.format", "json")
    .option("cloudFiles.schemaEvolutionMode", "failOnNewColumns")
    .schema(ORDER_SCHEMA)
    .load(SOURCE_PATH)
    .withColumn("source_file", F.input_file_name())
    .withColumn("ingested_at", F.current_timestamp())
)

query = (
    orders.writeStream.option("checkpointLocation", CHECKPOINT_PATH)
    .outputMode("append")
    .trigger(availableNow=True)
    .toTable(TARGET_TABLE)
)

query.awaitTermination()
