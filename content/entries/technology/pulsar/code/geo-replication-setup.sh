#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="commerce/orders"

# The tenant must already be allowed to use all listed clusters.
bin/pulsar-admin namespaces set-clusters \
  "$NAMESPACE" \
  --clusters us-west,us-east,eu-central

# Verify the namespace policy from the local cluster.
bin/pulsar-admin namespaces get-clusters "$NAMESPACE"
