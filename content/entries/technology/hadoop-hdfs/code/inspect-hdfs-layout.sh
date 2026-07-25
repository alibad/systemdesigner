#!/usr/bin/env bash
set -euo pipefail

target_path="${1:-/data/events}"

echo "Cluster capacity and DataNode health"
hdfs dfsadmin -report

echo "Block placement for ${target_path}"
hdfs fsck "${target_path}" -files -blocks -locations

echo "Configured defaults"
hdfs getconf -confKey dfs.blocksize
hdfs getconf -confKey dfs.replication

echo "Namespace listing"
hdfs dfs -ls -h "${target_path}"
