#!/usr/bin/env bash
set -euo pipefail

CONFIG="ticket-routing-config.yaml"
TRAIN_DATA="ticket-routing-train.parquet"
TEST_DATA="ticket-routing-test.parquet"
MODEL_PATH="results/api/experiment_run/model"

# Train from the reviewed, versioned contract.
ludwig train \
  --config "${CONFIG}" \
  --dataset "${TRAIN_DATA}" \
  --output_directory results

# Re-evaluate the saved artifact on a held-out dataset with ground truth.
ludwig evaluate \
  --model_path "${MODEL_PATH}" \
  --dataset "${TEST_DATA}" \
  --output_directory evaluation

# Start the built-in REST server for contract and smoke testing.
# Put authentication, rate limiting, rollout policy, and autoscaling around it.
ludwig serve \
  --model_path "${MODEL_PATH}" \
  --host 0.0.0.0 \
  --port 8000
