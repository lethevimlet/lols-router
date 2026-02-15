#!/bin/bash

# vLLM Setup Script for Qwen2.5-Coder-14B
# Target: RTX 5060 Ti (16GB VRAM)

set -e

echo "=== vLLM Setup for Qwen2.5-Coder-14B ==="
echo ""

# Check if running on remote
if [ ! -d "/home/ai" ]; then
    echo "❌ This script should run on the remote server (ai@192.168.0.21)"
    exit 1
fi

cd ~

# Create Python virtual environment
echo "📦 Creating Python virtual environment..."
if [ ! -d "~/vllm/venv" ]; then
    python3 -m venv ~/vllm/venv
fi

# Activate virtual environment
source ~/vllm/venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install vLLM with CUDA support
echo "📦 Installing vLLM..."
pip install vllm

# Create vllm directory
mkdir -p ~/vllm
cd ~/vllm

# Download Qwen2.5-Coder-14B model
echo "📥 Downloading Qwen2.5-Coder-14B model..."
echo "This will take a while (model is ~8GB)..."

# Create model directory
mkdir -p models

# Install huggingface-cli if needed
pip install --upgrade huggingface-hub

# Download model using huggingface-hub
python -c "
from huggingface_hub import snapshot_download
import os

model_id = 'Qwen/Qwen2.5-Coder-14B-Instruct'
cache_dir = os.path.expanduser('~/vllm/models')

print(f'Downloading {model_id} to {cache_dir}...')
snapshot_download(
    repo_id=model_id,
    cache_dir=cache_dir,
    local_dir=os.path.join(cache_dir, 'Qwen2.5-Coder-14B-Instruct'),
    local_dir_use_symlinks=False
)
print('Download complete!')
"

echo ""
echo "✅ vLLM setup complete!"
echo ""
echo "Model location: ~/vllm/models/Qwen2.5-Coder-14B-Instruct"
echo ""
echo "Next steps:"
echo "  1. Start vLLM server: ~/vllm/start-server.sh"
echo "  2. Check logs: ~/vllm/logs/"
