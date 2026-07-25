#!/usr/bin/env bash
set -euo pipefail

RIAK_URL="${RIAK_URL:-http://127.0.0.1:8098}"
BUCKET_TYPE="profiles"
BUCKET="customers"
KEY="customer-73"
OBJECT_URL="${RIAK_URL}/types/${BUCKET_TYPE}/buckets/${BUCKET}/keys/${KEY}"

headers_file="$(mktemp)"
body_file="$(mktemp)"
payload_file="$(mktemp)"
trap 'rm -f "${headers_file}" "${body_file}" "${payload_file}"' EXIT

# Read enough replicas for this request and retain the returned causal context.
curl --fail --silent --show-error \
  --dump-header "${headers_file}" \
  --output "${body_file}" \
  "${OBJECT_URL}?r=2&pr=1"

vclock="$(
  awk 'tolower($1) == "x-riak-vclock:" { $1 = ""; sub(/^ /, ""); print; exit }' \
    "${headers_file}" | tr -d '\r'
)"

if [[ -z "${vclock}" ]]; then
  printf '%s\n' "Riak did not return X-Riak-Vclock; stop instead of issuing a blind overwrite." >&2
  exit 1
fi

cat >"${payload_file}" <<'JSON'
{
  "customer_id": "customer-73",
  "plan": "pro",
  "region": "us-east",
  "profile_version": 12
}
JSON

# W is receipt acknowledgement, DW is durable acknowledgement, and PW requires
# one primary vnode. These values are request policy, not a universal default.
curl --fail --silent --show-error \
  --request PUT \
  --header "Content-Type: application/json" \
  --header "X-Riak-Vclock: ${vclock}" \
  --data-binary "@${payload_file}" \
  "${OBJECT_URL}?w=2&dw=2&pw=1"
