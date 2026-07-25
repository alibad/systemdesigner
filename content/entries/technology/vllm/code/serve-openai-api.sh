#!/usr/bin/env bash
set -euo pipefail

# Pin the vLLM package or container outside this script. Never use an unpinned
# development image in a release job.
: "${MODEL_ID:?Set MODEL_ID to a pinned model path or repository revision}"
: "${VLLM_API_KEY:?Set VLLM_API_KEY through the deployment secret store}"

SERVED_MODEL_NAME="${SERVED_MODEL_NAME:-assistant-production}"
TENSOR_PARALLEL_SIZE="${TENSOR_PARALLEL_SIZE:-1}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-8192}"
MAX_NUM_SEQS="${MAX_NUM_SEQS:-64}"
MAX_NUM_BATCHED_TOKENS="${MAX_NUM_BATCHED_TOKENS:-4096}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-0.85}"

exec vllm serve "${MODEL_ID}" \
  --host 0.0.0.0 \
  --port 8000 \
  --served-model-name "${SERVED_MODEL_NAME}" \
  --tensor-parallel-size "${TENSOR_PARALLEL_SIZE}" \
  --max-model-len "${MAX_MODEL_LEN}" \
  --max-num-seqs "${MAX_NUM_SEQS}" \
  --max-num-batched-tokens "${MAX_NUM_BATCHED_TOKENS}" \
  --gpu-memory-utilization "${GPU_MEMORY_UTILIZATION}" \
  --enable-prefix-caching
