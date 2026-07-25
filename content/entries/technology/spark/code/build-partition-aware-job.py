from dataclasses import dataclass

from pyspark.sql import DataFrame, SparkSession, functions as F


@dataclass(frozen=True)
class JoinContract:
    projected_dimension_limit_bytes: int
    shuffle_partitions: int
    output_partition_column: str


def estimated_bytes(frame: DataFrame) -> int:
    """Read the optimizer estimate without collecting the relation."""
    estimate = frame._jdf.queryExecution().optimizedPlan().stats().sizeInBytes()
    return int(estimate)


def build_daily_revenue(
    spark: SparkSession,
    *,
    events_path: str,
    accounts_path: str,
    output_path: str,
    run_date: str,
    contract: JoinContract,
) -> None:
    spark.conf.set(
        "spark.sql.shuffle.partitions",
        str(contract.shuffle_partitions),
    )

    events = (
        spark.read.format("parquet")
        .load(events_path)
        .where(F.col("event_date") == F.lit(run_date))
        .select("account_id", "event_date", "amount")
        .where(F.col("account_id").isNotNull())
    )
    accounts = (
        spark.read.format("parquet")
        .load(accounts_path)
        .select("account_id", "region", "plan")
        .dropDuplicates(["account_id"])
    )

    dimension_bytes = estimated_bytes(accounts)
    if dimension_bytes > contract.projected_dimension_limit_bytes:
        raise ValueError(
            "projected account dimension exceeds the reviewed broadcast limit: "
            f"{dimension_bytes} > {contract.projected_dimension_limit_bytes}"
        )

    joined = events.join(F.broadcast(accounts), "account_id", "inner")
    daily = (
        joined.groupBy("event_date", "region", "plan")
        .agg(
            F.sum("amount").alias("revenue"),
            F.count("*").alias("event_count"),
        )
        .repartition(contract.output_partition_column)
    )

    # The destination must provide an atomic or idempotent run-date commit.
    (
        daily.write.mode("overwrite")
        .partitionBy(contract.output_partition_column)
        .parquet(output_path)
    )
