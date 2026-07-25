#!/usr/bin/env bash
set -euo pipefail

target_path="${1:?usage: recover-replication.sh <hdfs-path> [replicas]}"
target_replicas="${2:-3}"

echo "Inspect current block health before changing policy"
hdfs fsck "${target_path}" -files -blocks -locations

echo "Request ${target_replicas} rack-aware replicas and wait for completion"
hdfs dfs -setrep -w "${target_replicas}" "${target_path}"

echo "Verify replica count, checksums, and placement after repair"
hdfs fsck "${target_path}" -files -blocks -locations

echo "Review remaining cluster-wide replication work"
hdfs dfsadmin -metasave /tmp/hdfs-replication-state.txt
