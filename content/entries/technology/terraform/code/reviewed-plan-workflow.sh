#!/usr/bin/env bash
set -euo pipefail

terraform fmt -check -recursive
terraform init -input=false
terraform validate

# A normal plan refreshes managed objects before comparing configuration,
# prior state, and the refreshed remote values.
terraform plan \
  -input=false \
  -lock-timeout=5m \
  -out=tfplan

# Plan files can contain sensitive values. Keep both forms out of source control.
terraform show -json tfplan > tfplan.json

# Run policy and human review against tfplan.json, then apply the saved artifact.
terraform apply -input=false tfplan
