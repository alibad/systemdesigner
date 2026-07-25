#!/usr/bin/env bash
set -euo pipefail

snapshot="${1:?usage: restore-new-cluster.sh SNAPSHOT MEMBER_NAME PEER_URL DATA_DIR}"
member_name="${2:?member name is required}"
peer_url="${3:?initial advertise peer URL is required}"
data_dir="${4:?empty restore data directory is required}"
cluster="etcd-1=https://10.20.0.11:2380,etcd-2=https://10.20.0.12:2380,etcd-3=https://10.20.0.13:2380"

test ! -e "${data_dir}" || {
  echo "refusing to restore over an existing data directory" >&2
  exit 1
}

restore_args=(
  --name="${member_name}"
  --data-dir="${data_dir}"
  --initial-cluster="${cluster}"
  --initial-cluster-token="coordination-restore-$(date -u +%Y%m%d)"
  --initial-advertise-peer-urls="${peer_url}"
)

# Current releases can invalidate stale watcher caches after a disaster restore.
if [[ -n "${BUMP_REVISION:-}" ]]; then
  restore_args+=(--bump-revision="${BUMP_REVISION}" --mark-compacted)
fi

etcdutl snapshot status "${snapshot}" --write-out=table
etcdutl snapshot restore "${snapshot}" "${restore_args[@]}"

echo "Restore created new member and cluster identity in ${data_dir}."
echo "Verify revision-bump requirements, TLS, hashes, membership, and RPO before startup."
