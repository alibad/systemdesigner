#!/usr/bin/env bash
set -euo pipefail

: "${KIBANA_URL:?Set KIBANA_URL, for example https://kibana.example.com}"
: "${KIBANA_API_KEY:?Set a scoped Kibana API key}"

curl --fail-with-body --silent --show-error \
  --request POST \
  "${KIBANA_URL}/s/operations/api/saved_objects/_export" \
  --header "Authorization: ApiKey ${KIBANA_API_KEY}" \
  --header "kbn-xsrf: true" \
  --header "Content-Type: application/json" \
  --data '{
    "objects": [
      {
        "type": "dashboard",
        "id": "checkout-operations"
      }
    ],
    "includeReferencesDeep": true,
    "excludeExportDetails": false
  }' \
  --output checkout-operations.ndjson

# Treat the NDJSON export as an opaque, versioned artifact. Do not hand-edit it.
