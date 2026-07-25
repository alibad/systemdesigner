#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="commerce/orders"

# Configure the object-store driver and destination for eligible ledger segments.
bin/pulsar-admin namespaces set-offload-policies \
  "$NAMESPACE" \
  --driver aws-s3 \
  --region us-west-2 \
  --bucket company-pulsar-archive \
  --offloadAfterElapsed 7d

# Keep seven days of acknowledged data and begin offloading closed segments
# after 100 GiB of namespace topic data remains in BookKeeper.
bin/pulsar-admin namespaces set-retention \
  "$NAMESPACE" \
  --time 7d \
  --size 500G

bin/pulsar-admin namespaces set-offload-threshold \
  "$NAMESPACE" \
  --size 100G
