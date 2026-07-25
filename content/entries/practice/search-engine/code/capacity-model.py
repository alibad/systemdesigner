#!/usr/bin/env python3
"""Estimate a search engine's crawl, index, and query fan-out envelope."""

from __future__ import annotations

import argparse
import json


SECONDS_PER_DAY = 86_400
PEAK_MULTIPLIER = 3.0
INDEX_TO_TEXT_RATIO = 0.30
INDEX_COPIES = 3
DOCUMENTS_PER_SHARD_GROUP = 250_000_000


def positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("value must be greater than zero")
    return parsed


def bounded_percent(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 100:
        raise argparse.ArgumentTypeError("percentage must be between 0 and 100")
    return parsed


def estimate(
    documents_billions: float,
    extracted_kb: float,
    daily_revisit_percent: float,
    daily_query_billions: float,
    result_cache_hit_percent: float,
) -> dict[str, float | int]:
    documents = documents_billions * 1_000_000_000
    raw_text_bytes = documents * extracted_kb * 1_000
    primary_index_bytes = raw_text_bytes * INDEX_TO_TEXT_RATIO
    revisits_per_day = documents * daily_revisit_percent / 100
    average_query_qps = daily_query_billions * 1_000_000_000 / SECONDS_PER_DAY
    peak_query_qps = average_query_qps * PEAK_MULTIPLIER
    shard_groups = max(
        1,
        int((documents + DOCUMENTS_PER_SHARD_GROUP - 1) // DOCUMENTS_PER_SHARD_GROUP),
    )
    uncached_fraction = 1 - result_cache_hit_percent / 100

    return {
        "documents": int(documents),
        "revisits_per_day": int(revisits_per_day),
        "required_fetch_qps": round(revisits_per_day / SECONDS_PER_DAY, 2),
        "primary_index_tb": round(primary_index_bytes / 1_000_000_000_000, 2),
        "replicated_index_tb": round(
            primary_index_bytes * INDEX_COPIES / 1_000_000_000_000,
            2,
        ),
        "average_query_qps": round(average_query_qps, 2),
        "peak_query_qps": round(peak_query_qps, 2),
        "document_shard_groups": shard_groups,
        "peak_shard_rpc_qps": round(peak_query_qps * uncached_fraction * shard_groups, 2),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--documents-billions", type=positive_float, default=10)
    parser.add_argument("--extracted-kb", type=positive_float, default=20)
    parser.add_argument("--daily-revisit-percent", type=bounded_percent, default=5)
    parser.add_argument("--daily-query-billions", type=positive_float, default=4)
    parser.add_argument("--result-cache-hit-percent", type=bounded_percent, default=25)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = estimate(
        documents_billions=args.documents_billions,
        extracted_kb=args.extracted_kb,
        daily_revisit_percent=args.daily_revisit_percent,
        daily_query_billions=args.daily_query_billions,
        result_cache_hit_percent=args.result_cache_hit_percent,
    )
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
