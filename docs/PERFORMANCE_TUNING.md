# Performance Tuning for lols-router

Guide to optimizing model performance, especially for large models (14B+ parameters).

## Performance Parameters

Models can be optimized with per-model performance settings in `models.json`:

```json
{
  "models": {
    "qwen3-14b-instruct": {
      "type": "llama-cpp",
      "repo": "bartowski/Qwen_Qwen3-14B-GGUF",
      "file": "Qwen_Qwen3-14B-Q4_K_M.gguf",
      "context": 32768,
      "port": 8022,
      "performance": {
        "flashAttention": true,
        "batch": 2048,
        "ubatch": 512,
        "threads": 8,
        "parallel": 4
      }
    }
  }
}
```

### Parameter Reference

| Parameter | Flag | Description | Recommended Values |
|-----------|------|-------------|-------------------|
| `flashAttention` | `--flash-attn` | Hardware-accelerated attention (Ada Lovelace+ GPUs) | `true` for RTX 40xx/50xx |
| `batch` | `-b` | Batch size for prompt processing | 512-2048 for 14B models |
| `ubatch` | `-ub` | Micro-batch size (memory vs speed tradeoff) | 256-512 (smaller = less VRAM) |
| `threads` | `-t` | CPU threads for processing | 4-8 (depends on CPU cores) |
| `parallel` | `-np` | Parallel request slots | 1-4 (single-user) or 4-8 (multi-user) |

---

## Flash Attention

**What it does**: Uses GPU tensor cores for faster attention computation  
**Requirements**: Ada Lovelace (RTX 40xx/50xx) or newer  
**Performance gain**: 2-3x faster inference  
**Verified GPUs**: RTX 5060 Ti (compute capability 12.0)

### Enable Flash Attention

```json
"performance": {
  "flashAttention": true
}
```

⚠️ **Note**: Requires compatible GPU. If llama-server crashes on startup, disable this.

---

## Batch Sizes

### Batch Size (`-b`)
Controls how many tokens are processed in parallel during prompt ingestion.

**Impact**:
- **Higher** = Faster prompt processing, more VRAM usage
- **Lower** = Slower prompts, less VRAM

**Recommendations**:
- **3B models**: 512
- **7B models**: 1024
- **14B models**: 2048
- **Low VRAM**: 256-512

### Micro-Batch Size (`-ub`)
Controls how many tokens are processed per iteration.

**Impact**:
- **Higher** = Faster, more VRAM
- **Lower** = Slower, less VRAM

**Recommendations**:
- **Standard**: 512
- **Low VRAM**: 256
- **High performance**: 1024

---

## CPU Threads

**What it does**: Number of CPU threads for model operations (sampling, KV cache)

**Recommendations**:
- **Single-user**: 4-8 threads
- **Multi-user**: 8-16 threads
- **Max**: Total CPU cores - 2 (leave some for system)

**Example**:
```json
"performance": {
  "threads": 8
}
```

---

## Parallel Request Slots

**What it does**: Number of concurrent requests the model can handle

**Impact**:
- **More slots** = More users can queue requests
- **Fewer slots** = Lower memory overhead

**Recommendations**:
- **Single-user (personal)**: 1-4 slots
- **Multi-user (shared)**: 4-8 slots
- **Server (production)**: 8-16 slots

**Example**:
```json
"performance": {
  "parallel": 4
}
```

---

## Optimization Recipes

### 🚀 Maximum Performance (RTX 5060 Ti, 16GB VRAM)

For **qwen3-14b-instruct** (8.4 GB model):

```json
"performance": {
  "flashAttention": true,
  "batch": 2048,
  "ubatch": 512,
  "threads": 8,
  "parallel": 4
}
```

**Expected improvement**: 2-3x faster inference  
**VRAM usage**: ~10-12 GB  
**Best for**: Single-user coding/reasoning tasks

---

### ⚡ Balanced (Lower VRAM)

For systems with limited VRAM:

```json
"performance": {
  "flashAttention": true,
  "batch": 1024,
  "ubatch": 256,
  "threads": 4,
  "parallel": 2
}
```

**VRAM usage**: ~9-10 GB  
**Best for**: General use with VRAM headroom

---

### 🔋 Low VRAM (8-10 GB available)

For 8-10 GB VRAM cards:

```json
"performance": {
  "flashAttention": false,
  "batch": 512,
  "ubatch": 128,
  "threads": 4,
  "parallel": 1
}
```

**VRAM usage**: ~8-9 GB  
**Best for**: Smaller cards or multi-model setups

---

### 🏢 Multi-User Server

For production environments with multiple users:

```json
"performance": {
  "flashAttention": true,
  "batch": 1024,
  "ubatch": 512,
  "threads": 12,
  "parallel": 8
}
```

**VRAM usage**: ~11-13 GB  
**Best for**: Shared servers with queued requests

---

## Troubleshooting

### Model crashes on startup with flash attention
**Solution**: Disable flash attention in models.json:
```json
"performance": {
  "flashAttention": false
}
```

### Out of memory errors
**Solution**: Reduce batch sizes:
```json
"performance": {
  "batch": 512,
  "ubatch": 256
}
```

### Slow prompt processing
**Solution**: Increase batch size (if VRAM allows):
```json
"performance": {
  "batch": 2048
}
```

### Slow generation (tokens/sec)
**Likely causes**:
- GPU not being used (check `-ngl` in logs)
- Model too large for VRAM (check `nvidia-smi`)
- Flash attention not enabled
- Thermal throttling (check GPU temperature)

---

## Measuring Performance

### Tokens/Second
Watch the GUI or check PM2 logs:
```bash
node scripts/remote-helper.js logs
```

Look for lines like:
```
llama_perf_sampler_print:    sampling time =      45.67 ms /   100 runs
llama_perf_context_print:        eval time =    1234.56 ms /   100 runs ( 12.35 ms per token,  80.97 tokens per second)
```

**Good performance**:
- **14B Q4_K_M on RTX 5060 Ti**: 50-80 tokens/sec
- **7B Q4_K_M on RTX 5060 Ti**: 100-150 tokens/sec
- **3B Q4_K_M on RTX 5060 Ti**: 150-200+ tokens/sec

### VRAM Usage
Check current usage:
```bash
node scripts/remote-helper.js exec "nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader"
```

Or view in GUI metrics panel.

---

## Why is Qwen3 Slower than Qwen2.5?

Qwen3 architecture may differ from Qwen2.5 in ways that affect performance:

1. **Attention mechanism**: Qwen3 may use different attention patterns
2. **Vocabulary size**: Larger vocab = more computation per token
3. **Model layers**: Different layer structure affects cache usage
4. **Rope scaling**: Different positional encoding strategies

**With optimizations applied** (flash attention, proper batch sizes), Qwen3-14B should perform similarly to or better than Qwen2.5-14B.

---

## Verifying Optimizations

After updating models.json and llama.js, restart the model:

```bash
# Sync changes to remote
npm run deploy

# Or manually:
node scripts/remote-helper.js sync
node scripts/remote-helper.js restart
```

Check logs to confirm parameters are applied:
```bash
node scripts/remote-helper.js logs
```

Look for:
```
[llama] Flash attention enabled
[llama] Batch size: 2048
[llama] Micro-batch size: 512
[llama] CPU threads: 8
[llama] Parallel slots: 4
```

---

## Additional Resources

- [llama.cpp server docs](https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md)
- [llama.cpp performance tips](https://github.com/ggerganov/llama.cpp/discussions/4225)
- [GPU optimization guide](https://github.com/ggerganov/llama.cpp/blob/master/docs/build.md#cuda)

---

## Related Documentation

- [LOLS_SMART_ROUTING.md](LOLS_SMART_ROUTING.md) - Routing system
- [GPU_HANG_FIX.md](GPU_HANG_FIX.md) - Timeout and hang fixes
- [REMOTE_TESTING.md](REMOTE_TESTING.md) - Deployment guide
