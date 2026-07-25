#!/usr/bin/env bash
set -euo pipefail

export ETCDCTL_ENDPOINTS="https://etcd-1:2379,https://etcd-2:2379,https://etcd-3:2379"
export ETCDCTL_CACERT="/run/secrets/etcd/ca.crt"
export ETCDCTL_CERT="/run/secrets/etcd/client.crt"
export ETCDCTL_KEY="/run/secrets/etcd/client.key"

etcdctl endpoint health --cluster --write-out=table
etcdctl endpoint status --cluster --write-out=table
etcdctl alarm list

# Save and verify a snapshot before membership, upgrade, or repair work.
snapshot="/backups/etcd-$(date -u +%Y%m%dT%H%M%SZ).db"
etcdctl snapshot save "${snapshot}"
etcdutl snapshot status "${snapshot}" --write-out=table

# Compact only to a reviewed revision. Defragment members one at a time.
: "${COMPACT_REVISION:?set a reviewed compaction revision}"
etcdctl compact "${COMPACT_REVISION}"

IFS=',' read -r -a endpoints <<<"${ETCDCTL_ENDPOINTS}"
for endpoint in "${endpoints[@]}"; do
  etcdctl --endpoints="${endpoint}" defrag
  etcdctl --endpoints="${endpoint}" endpoint status --write-out=table
done

# Clear NOSPACE only after an operator verifies backend usage and cluster health.
if [[ "${DISARM_NOSPACE:-false}" == "true" ]]; then
  etcdctl alarm disarm
fi
