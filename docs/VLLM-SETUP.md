# vLLM Setup Guide

## Overview

vLLM provides faster inference than llama.cpp with better memory management through PagedAttention.

## Installation

### Automated Setup

```bash
# On remote server (192.168.0.21)
cd ~/vllm
./setup-vllm.sh
```

This script will:
1. Create Python virtual environment
2. Install vLLM and dependencies
3. Download Qwen2.5-Coder-14B-Instruct model (~8GB)

### Manual Setup

```bash
# Create venv
python3 -m venv ~/vllm/venv
source ~/vllm/venv/bin/activate

# Install vLLM
pip install vllm

# Download model
pip install huggingface-hub
python -m huggingface_hub.cli download \
  Qwen/Qwen2.5-Coder-14B-Instruct \
  --local-dir ~/vllm/models/Qwen2.5-Coder-14B-Instruct
```

## Starting the Server

### Using PM2 (Recommended)

```bash
cd ~/vllm
pm2 start vllm-pm2.config.js
pm2 status
pm2 logs vllm-qwen-14b
```

### Manual Start

```bash
cd ~/vllm
./vllm-server.sh
```

## Configuration

### Model Settings
- **Model**: Qwen/Qwen2.5-Coder-14B-Instruct
- **Context Window**: 80,000 tokens (81,920)
- **Port**: 8027
- **Host**: 0.0.0.0 (accessible from network)

### Performance Settings
- **GPU Memory Utilization**: 90% (14.4GB / 16GB VRAM)
- **Max Concurrent Sequences**: 8
- **Tensor Parallel Size**: 1 (single GPU)
- **Data Type**: auto (bf16 or fp16 based on GPU support)

## Memory Usage

### vLLM (with PagedAttention)
- **Model weights**: ~8GB
- **KV cache (dynamic)**: ~5-6GB
- **Total VRAM**: ~13-14GB / 16GB available
- **Overhead**: Minimal thanks to PagedAttention

### vs llama.cpp (for comparison)
- **Model weights**: ~9GB (Q4_K_M)
- **KV cache (fixed)**: ~6-7GB (80k context)
- **Total VRAM**: ~13-14GB (with RAM offloading)
- **Overhead**: Fixed KV cache allocation

## Performance Comparison

| Backend | Prompt Speed | Generation Speed | Latency |
|---------|--------------|------------------|---------|
| **vLLM** | ~3,000-5,000 tok/s | ~80-100 tok/s | ✅ Lower |
| llama.cpp | ~1,500 tok/s | ~45 tok/s | ❌ Higher |

## Benefits of vLLM

1. **PagedAttention**: Dynamic memory allocation for KV cache
2. **Continuous Batching**: Better GPU utilization
3. **Faster Inference**: 2-5x speedup vs llama.cpp
4. **Better Batching**: Handle multiple requests efficiently
5. **Industry Standard**: Used by production AI services

## API Compatibility

vLLM provides OpenAI-compatible API:

```bash
# Test the API
curl http://192.168.0.21:8027/v1/models

# Chat completion
curl http://192.168.0.21:8027/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder-14b-instruct-vllm",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

## OpenClaw Integration

Add to OpenClaw config (`openclaw.json`):

```json
{
  "models": {
    "providers": {
      "vllm": {
        "baseUrl": "http://192.168.0.21:8027/v1",
        "auth": "none",
        "api": "openai-completions",
        "models": [
          {
            "id": "qwen2.5-coder-14b-instruct-vllm",
            "name": "Qwen 2.5 Coder 14B (vLLM - 80k, fast)",
            "contextWindow": 80000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

Then use it:
```bash
/model vllm/qwen2.5-coder-14b-instruct-vllm
```

## Monitoring

```bash
# PM2 status
pm2 status vllm-qwen-14b

# View logs
pm2 logs vllm-qwen-14b

# GPU usage
watch -n 1 nvidia-smi

# Restart
pm2 restart vllm-qwen-14b
```

## Troubleshooting

### Out of Memory
- Reduce `--gpu-memory-utilization` (try 0.85 or 0.80)
- Reduce `--max-model-len` (try 65536 for 64k)
- Reduce `--max-num-seqs` (try 4 or 2)

### Slow Startup
- vLLM loads the full model into VRAM on startup
- Takes 30-60 seconds for 14B model
- Check logs: `pm2 logs vllm-qwen-14b`

### Connection Issues
- Ensure port 8027 is not blocked by firewall
- Check server is running: `pm2 status`
- Test locally first: `curl http://localhost:8027/v1/models`

## Maintenance

### Update vLLM
```bash
source ~/vllm/venv/bin/activate
pip install --upgrade vllm
pm2 restart vllm-qwen-14b
```

### Update Model
```bash
source ~/vllm/venv/bin/activate
huggingface-cli download Qwen/Qwen2.5-Coder-14B-Instruct \
  --local-dir ~/vllm/models/Qwen2.5-Coder-14B-Instruct \
  --resume-download
```

## References

- [vLLM Documentation](https://docs.vllm.ai/)
- [Qwen2.5-Coder Model Card](https://huggingface.co/Qwen/Qwen2.5-Coder-14B-Instruct)
- [PagedAttention Paper](https://arxiv.org/abs/2309.06180)
