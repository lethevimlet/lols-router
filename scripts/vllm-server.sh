#!/bin/bash

# vLLM Server Startup Script
# Qwen2.5-Coder-14B with 80k context

# Activate virtual environment
source "$HOME/vllm/venv/bin/activate"

MODEL_PATH="$HOME/vllm/models/Qwen2.5-Coder-14B-Instruct"
PORT=8027
HOST="0.0.0.0"

# vLLM configuration for RTX 5060 Ti (16GB VRAM)
MAX_MODEL_LEN=81920  # 80k context
GPU_MEMORY_UTILIZATION=0.90  # Use 90% of VRAM
MAX_NUM_SEQS=8  # Concurrent sequences
TENSOR_PARALLEL_SIZE=1  # Single GPU

# Start vLLM server
echo "🚀 Starting vLLM server..."
echo "Model: $MODEL_PATH"
echo "Port: $PORT"
echo "Context: $MAX_MODEL_LEN tokens"
echo ""

python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL_PATH" \
    --host "$HOST" \
    --port "$PORT" \
    --max-model-len "$MAX_MODEL_LEN" \
    --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
    --max-num-seqs "$MAX_NUM_SEQS" \
    --tensor-parallel-size "$TENSOR_PARALLEL_SIZE" \
    --dtype auto \
    --trust-remote-code \
    --served-model-name "qwen2.5-coder-14b-instruct-vllm"
