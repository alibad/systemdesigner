"""Keep one entity on one side of the evaluation boundary."""

from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import TypedDict


class Row(TypedDict):
    customer_id: str
    balance: float | None
    label: int


def split_by_entity(
    rows: list[Row], held_out_customers: set[str]
) -> tuple[list[Row], list[Row]]:
    train = [row for row in rows if row["customer_id"] not in held_out_customers]
    test = [row for row in rows if row["customer_id"] in held_out_customers]
    return train, test


def fit_balance_imputer(train: list[Row]) -> float:
    observed = [row["balance"] for row in train if row["balance"] is not None]
    if not observed:
        raise ValueError("Training data contains no observed balances")
    return mean(observed)


def apply_balance_imputer(rows: list[Row], fill_value: float) -> list[Row]:
    return [
        {**row, "balance": row["balance"] if row["balance"] is not None else fill_value}
        for row in rows
    ]


def entities_by_partition(train: list[Row], test: list[Row]) -> dict[str, set[str]]:
    partitions: dict[str, set[str]] = defaultdict(set)
    for row in train:
        partitions["train"].add(row["customer_id"])
    for row in test:
        partitions["test"].add(row["customer_id"])
    return partitions


if __name__ == "__main__":
    data: list[Row] = [
        {"customer_id": "A", "balance": 20.0, "label": 0},
        {"customer_id": "A", "balance": None, "label": 1},
        {"customer_id": "B", "balance": 40.0, "label": 0},
        {"customer_id": "B", "balance": 55.0, "label": 1},
        {"customer_id": "C", "balance": 500.0, "label": 1},
        {"customer_id": "C", "balance": None, "label": 1},
    ]

    train_rows, test_rows = split_by_entity(data, held_out_customers={"C"})
    fill = fit_balance_imputer(train_rows)
    prepared_train = apply_balance_imputer(train_rows, fill)
    prepared_test = apply_balance_imputer(test_rows, fill)
    partitions = entities_by_partition(prepared_train, prepared_test)

    assert partitions["train"].isdisjoint(partitions["test"])
    assert fill == 115 / 3
    assert prepared_test[-1]["balance"] == fill
    print({"train_entities": sorted(partitions["train"]), "test_entities": ["C"], "fill": fill})
