#!/usr/bin/env bash
set -euo pipefail

TOPIC="persistent://commerce/orders/order-events"
NAMESPACE="commerce/orders"

# Create explicit producer-side lanes for this topic.
bin/pulsar-admin topics create-partitioned-topic \
  "$TOPIC" \
  --partitions 12

# E=3 bookies in the ensemble, W=3 writes per entry, A=2 durable
# acknowledgments required before the broker reports publish success.
bin/pulsar-admin namespaces set-persistence \
  "$NAMESPACE" \
  --bookkeeper-ensemble 3 \
  --bookkeeper-write-quorum 3 \
  --bookkeeper-ack-quorum 2

bin/pulsar-admin topics get-partitioned-topic-metadata "$TOPIC"
bin/pulsar-admin namespaces get-persistence "$NAMESPACE"
