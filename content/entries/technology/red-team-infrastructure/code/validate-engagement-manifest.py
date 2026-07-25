#!/usr/bin/env python3
"""Validate the safety envelope for an authorized security exercise."""

import argparse
import ipaddress
import json
from datetime import datetime


EXAMPLE = {
    "engagement_id": "rt-2030-0042",
    "owner": "security-assurance",
    "evidence_owner": "security-operations",
    "stop_contact": "incident-commander",
    "starts_at": "2030-04-08T08:00:00+00:00",
    "ends_at": "2030-04-12T18:00:00+00:00",
    "approved_networks": ["10.24.0.0/26"],
    "excluded_networks": ["10.24.0.64/26"],
}


def load_manifest(path):
    if path is None:
        return EXAMPLE
    with open(path, encoding="utf-8") as manifest_file:
        return json.load(manifest_file)


def validate(manifest):
    errors = []
    required = (
        "engagement_id", "owner", "evidence_owner", "stop_contact",
        "starts_at", "ends_at", "approved_networks", "excluded_networks",
    )
    for field in required:
        if not manifest.get(field):
            errors.append(f"missing required field: {field}")

    try:
        starts_at = datetime.fromisoformat(manifest["starts_at"])
        ends_at = datetime.fromisoformat(manifest["ends_at"])
        if starts_at.tzinfo is None or ends_at.tzinfo is None:
            errors.append("time bounds must include a UTC offset")
        if ends_at <= starts_at:
            errors.append("ends_at must be later than starts_at")
    except (KeyError, TypeError, ValueError):
        errors.append("starts_at and ends_at must be ISO-8601 timestamps")

    try:
        approved = [ipaddress.ip_network(value) for value in manifest["approved_networks"]]
        excluded = [ipaddress.ip_network(value) for value in manifest["excluded_networks"]]
        if any(left.overlaps(right) for left in approved for right in excluded):
            errors.append("approved and excluded networks overlap")
    except (KeyError, TypeError, ValueError):
        errors.append("network entries must be valid CIDR ranges")

    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", nargs="?", help="JSON manifest; defaults to a safe example")
    args = parser.parse_args()
    errors = validate(load_manifest(args.manifest))

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        raise SystemExit(1)

    print("PASS: authorization envelope is bounded and reviewable")


if __name__ == "__main__":
    main()
