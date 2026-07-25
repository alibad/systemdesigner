#!/usr/bin/env bash
set -euo pipefail

: "${ORC_TOOLS_JAR:?Set ORC_TOOLS_JAR to the Apache ORC tools uber jar}"
file="${1:?Usage: inspect-orc-file.sh <file.orc> [predicate-value]}"
predicate_value="${2:-2026-07-23}"

# Inspect the schema, stripes, compression, statistics, and row-index metadata.
java -jar "$ORC_TOOLS_JAR" meta --json --column-type --rowindex 1 "$file"

# Account for data and metadata bytes separately.
java -jar "$ORC_TOOLS_JAR" sizes "$file"

# Ask whether statistics and an optional Bloom filter can reject a value.
java -jar "$ORC_TOOLS_JAR" check \
  --type predicate \
  "$file" \
  --column event_day \
  --values "$predicate_value"
