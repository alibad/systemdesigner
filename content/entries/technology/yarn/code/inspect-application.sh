#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 APPLICATION_ID [APPLICATION_ATTEMPT_ID]" >&2
  exit 2
fi

app_id="$1"
attempt_id="${2:-}"

yarn application -status "$app_id"
yarn applicationattempt -list "$app_id"
yarn logs -applicationId "$app_id" -log_files stderr,syslog

if [[ -n "$attempt_id" ]]; then
  yarn container -list "$attempt_id"
fi

yarn node -list -all
yarn queue -status root.analytics
