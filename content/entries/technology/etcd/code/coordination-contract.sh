#!/usr/bin/env bash
set -euo pipefail

ETCDCTL=(
  etcdctl
  --endpoints=https://etcd-1:2379,https://etcd-2:2379,https://etcd-3:2379
  --cacert=/run/secrets/etcd/ca.crt
  --cert=/run/secrets/etcd/client.crt
  --key=/run/secrets/etcd/client.key
)

list_and_watch() {
  # Read a complete prefix and keep its revision as the cache/watch boundary.
  snapshot_json="$("${ETCDCTL[@]}" get /services/payments/ --prefix --write-out=json)"
  snapshot_revision="$(jq -r '.header.revision' <<<"${snapshot_json}")"
  "${ETCDCTL[@]}" watch /services/payments/ --prefix --rev="$((snapshot_revision + 1))"
}

register_with_lease() {
  # Lease keep-alive owns this process until shutdown or connectivity loss.
  lease_json="$("${ETCDCTL[@]}" lease grant 30 --write-out=json)"
  lease_id="$(jq -r '.ID' <<<"${lease_json}")"
  "${ETCDCTL[@]}" put /services/payments/instance-a 10.20.4.18:8443 --lease="${lease_id}"
  "${ETCDCTL[@]}" lease keep-alive "${lease_id}"
}

compare_and_swap() {
  expected_revision="${EXPECTED_REVISION:?set the observed modification revision}"
  "${ETCDCTL[@]}" txn <<EOF
compare
mod("/config/payments") = "${expected_revision}"

success requests
put /config/payments '{"timeout_ms":800}'

failure requests
get /config/payments
EOF
}

case "${1:-}" in
  list-watch) list_and_watch ;;
  register) register_with_lease ;;
  compare-swap) compare_and_swap ;;
  *) echo "usage: $0 list-watch|register|compare-swap" >&2; exit 2 ;;
esac
