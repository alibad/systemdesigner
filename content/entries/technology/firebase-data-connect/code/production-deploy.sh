#!/usr/bin/env bash
set -euo pipefail

# Inspect the deployed service and the SQL changes before mutation.
firebase dataconnect:services:list
firebase dataconnect:sql:diff storefront

# Approve and apply the reviewed PostgreSQL migration.
firebase dataconnect:sql:migrate storefront

# Deploy schema and connectors; breaking connector assessments fail CI.
firebase deploy --only dataconnect --non-interactive

# Rebuild generated client contracts from the deployed operation sources.
firebase dataconnect:sdk:generate
