#!/usr/bin/env python3
"""Generate an SRI token for one immutable release asset."""

import argparse
import base64
import hashlib
from pathlib import Path

ALGORITHMS = ("sha256", "sha384", "sha512")


def sri_token(path: Path, algorithm: str) -> str:
    digest = hashlib.new(algorithm, path.read_bytes()).digest()
    return f"{algorithm}-{base64.b64encode(digest).decode('ascii')}"


parser = argparse.ArgumentParser()
parser.add_argument("asset", type=Path)
parser.add_argument("--algorithm", choices=ALGORITHMS, default="sha384")
args = parser.parse_args()

if not args.asset.is_file():
    parser.error(f"asset does not exist: {args.asset}")

print(sri_token(args.asset, args.algorithm))
