from __future__ import annotations

import hashlib
import json
from pathlib import Path

import duckdb


RUN_ID = "orders-2026-07"
INPUT_GLOB = "warehouse/orders/year=2026/month=07/*.parquet"
STAGING_DIR = Path("published/staging") / RUN_ID
OUTPUT_FILE = STAGING_DIR / "regional-revenue.parquet"
MANIFEST_FILE = STAGING_DIR / "manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


STAGING_DIR.mkdir(parents=True, exist_ok=False)

with duckdb.connect("analytics.duckdb") as connection:
    connection.execute("SET threads = 4")
    connection.execute("SET memory_limit = '8GB'")
    connection.execute("SET temp_directory = 'runtime/duckdb-tmp'")
    connection.execute("SET preserve_insertion_order = false")

    connection.execute(
        f"""
        COPY (
            SELECT
                customer_region,
                count(*) AS paid_orders,
                sum(net_amount) AS net_revenue
            FROM read_parquet('{INPUT_GLOB}')
            WHERE
                order_status = 'paid'
                AND order_date >= DATE '2026-07-01'
                AND order_date < DATE '2026-08-01'
            GROUP BY customer_region
        )
        TO '{OUTPUT_FILE.as_posix()}'
        (FORMAT parquet, COMPRESSION zstd)
        """
    )

    checks = connection.execute(
        f"""
        SELECT
            count(*) AS region_count,
            count(*) FILTER (WHERE customer_region IS NULL) AS null_regions,
            count(*) FILTER (WHERE net_revenue < 0) AS negative_totals
        FROM read_parquet('{OUTPUT_FILE.as_posix()}')
        """
    ).fetchone()

if checks is None:
    raise RuntimeError("Validation query returned no result")

region_count, null_regions, negative_totals = checks
if region_count == 0 or null_regions != 0 or negative_totals != 0:
    raise RuntimeError(
        "Output validation failed: "
        f"regions={region_count}, nulls={null_regions}, negatives={negative_totals}"
    )

manifest = {
    "run_id": RUN_ID,
    "input": INPUT_GLOB,
    "output": OUTPUT_FILE.as_posix(),
    "output_sha256": sha256(OUTPUT_FILE),
    "validation": {
        "region_count": region_count,
        "null_regions": null_regions,
        "negative_totals": negative_totals,
    },
}
MANIFEST_FILE.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

# Promote STAGING_DIR with an atomic rename or versioned object-store pointer only
# after an independent release step verifies this manifest.
