#!/usr/bin/env bash
set -euo pipefail

target_path="${1:-/data/sensitive}"

echo "Authentication and transport policy"
hdfs getconf -confKey hadoop.security.authentication
hdfs getconf -confKey hadoop.rpc.protection
hdfs getconf -confKey dfs.encrypt.data.transfer

echo "Owner, group, and mode"
hdfs dfs -ls -d "${target_path}"

echo "Access-control entries"
hdfs dfs -getfacl "${target_path}"

echo "Encryption zones"
hdfs crypto -listZones

echo "The operator should now reconcile unexpected access with audit events."
