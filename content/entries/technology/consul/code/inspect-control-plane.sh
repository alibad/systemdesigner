#!/usr/bin/env bash
set -euo pipefail

: "${CONSUL_HTTP_ADDR:=https://127.0.0.1:8501}"
: "${CONSUL_HTTP_TOKEN:?set a read-only operator token}"

consul members -detailed
consul members -wan
consul operator raft list-peers
consul operator autopilot state

curl --fail --silent --show-error --include \
  --header "X-Consul-Token: ${CONSUL_HTTP_TOKEN}" \
  --header "Cache-Control: max-age=30, stale-if-error=300" \
  "${CONSUL_HTTP_ADDR}/v1/health/service/payments?passing=true&cached=true"
