#!/usr/bin/env bash
set -euo pipefail

chart="./charts/payments"
release="payments"
namespace="payments-prod"
values="./environments/production.yaml"

helm lint "$chart" --values "$values"
helm template "$release" "$chart" --namespace "$namespace" --values "$values" > rendered.yaml
kubectl apply --dry-run=server --filename rendered.yaml

helm upgrade "$release" "$chart" \
  --install \
  --namespace "$namespace" \
  --values "$values" \
  --atomic \
  --timeout 10m
