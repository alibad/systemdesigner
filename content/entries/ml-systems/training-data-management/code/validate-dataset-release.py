#!/usr/bin/env python3
"""Evaluate pass, quarantine, and block outcomes from the release-gate fixture."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR.parent / "data" / "release-gate-lab.json"


def gate_passes(gate: dict[str, Any], value: float) -> bool:
    if gate["direction"] == "maximum":
        return value <= float(gate["threshold"])
    if gate["direction"] == "minimum":
        return value >= float(gate["threshold"])
    raise ValueError(f"Unsupported gate direction: {gate['direction']}")


def evaluate_candidate(
    gates: list[dict[str, Any]], candidate: dict[str, Any]
) -> tuple[str, list[str]]:
    metrics = candidate["metrics"]
    failures: list[dict[str, Any]] = []

    for gate in gates:
        gate_id = gate["id"]
        if gate_id not in metrics:
            raise ValueError(f"Candidate {candidate['id']} is missing metric {gate_id}.")
        if not gate_passes(gate, float(metrics[gate_id])):
            failures.append(gate)

    if any(gate["severity"] == "block" for gate in failures):
        decision = "block"
    elif failures:
        decision = "quarantine"
    else:
        decision = "pass"

    return decision, [str(gate["label"]) for gate in failures]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gate_file", nargs="?", type=Path, default=DEFAULT_INPUT)
    args = parser.parse_args()

    fixture = json.loads(args.gate_file.read_text(encoding="utf-8"))
    gates = fixture["gates"]
    candidates = fixture["examples"]

    for candidate in candidates:
        decision, failures = evaluate_candidate(gates, candidate)
        expected = candidate["expectedDecision"]
        if decision != expected:
            raise AssertionError(
                f"{candidate['id']}: expected {expected}, calculated {decision}"
            )
        failure_text = ", ".join(failures) if failures else "none"
        print(f"{candidate['id']}: {decision}; failed gates: {failure_text}")


if __name__ == "__main__":
    main()
