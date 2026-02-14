# Performance Optimization Guide

## qwen3-14b Performance Fix (Feb 2025)

### Problem
- qwen3-14b running at only **10-15 tokens/sec** on RTX 5060 Ti (16GB)
- Performance settings in `models.json` were being **IGNORED**
- Orchestrator wasn't passing them to llama-server

### Root Cause
The `orchestrator.js` was not passing the `performance` object from model config to the `startLlama()` function. All performance flags were defined but never applied!

### Solution

#### 1. Fix Orchestrator (`src/helpers/orchestrator.js`)
Added code to pass performance settings to llama starter:
```javascript
// Pass performance settings
if (model.performance) {
  llamaConfig.performance = model.performance;
  log.info("performance settings:", JSON.stringify(model.performance));
}
```

#### 2. Enhance llama.js (`src/helpers/llama.js`)
Added support for additional performance flags:
- `--cont-batching` - Continuous batching for better throughput
- `--cache-type-k f16` - KV cache optimization (keys)
- `--cache-type-v f16` - KV cache optimization (values)

#### 3. Optimize Settings (`models.json`)
Updated qwen3-14b-instruct performance config:

```json
{
  "performance": {
    "flashAttention": true,    // Blackwell GPU support
    "batch": 8192,             // 4x increase (was 2048)
    "ubatch": 2048,            // 4x increase (was 512)
    "threads": 12,             // 50% more (was 8)
    "parallel": 1,             // Reduced (was 4, better for single-GPU)
    "contBatching": true,      // NEW: Continuous batching
    "cacheTypeK": "f16",       // NEW: Memory optimization
    "cacheTypeV": "f16"        // NEW: Memory optimization
  }
}
```

### Expected Results
- **Before**: 10-15 tokens/sec 😢
- **After**: 30-50+ tokens/sec 🚀
- **Improvement**: 2-4x faster

### Testing
Run the performance test:
```bash
node test-qwen3-perf.js
```

Verify the process has all flags:
```bash
node scripts/remote-helper.js exec "ps aux | grep llama-server | grep 8022"
```

Should show:
```
--flash-attn -b 8192 -ub 2048 -t 12 -np 1 --cont-batching --cache-type-k f16 --cache-type-v f16
```

### Performance Tuning Tips

#### Batch Size (`-b`)
- Higher = better throughput
- Limited by VRAM
- 8192 is optimal for 16GB VRAM with Q4_K_M

#### Micro-batch (`-ub`)
- Higher = faster processing
- Must be ≤ batch size
- 2048 is aggressive but safe on 16GB

#### Threads (`-t`)
- Match your CPU core count
- 12 is optimal for typical desktop CPUs
- Don't exceed physical cores

#### Parallel Slots (`-np`)
- Number of simultaneous requests
- 1-2 recommended for single-GPU orchestration
- Higher values split VRAM between requests

#### Flash Attention
- REQUIRED for Ada Lovelace/Blackwell GPUs (RTX 40xx/50xx)
- Massive speedup with no downside
- Always enable if supported

#### KV Cache Type
- `f32` = highest precision, most VRAM
- `f16` = good precision, 50% less VRAM
- `q8_0` = slight quality loss, 75% less VRAM
- `q4_0` = noticeable quality loss, 87.5% less VRAM

For Q4_K_M models, `f16` is the sweet spot.

### Troubleshooting

**Still slow after update?**
1. Check if model reloaded: `node scripts/remote-helper.js status`
2. Kill old processes: `node scripts/remote-helper.js exec "pkill -9 llama-server"`
3. Restart server: `node scripts/remote-helper.js restart`
4. Check logs: `node scripts/remote-helper.js logs`

**Out of memory errors?**
Reduce batch/ubatch sizes:
```json
{
  "batch": 4096,
  "ubatch": 1024
}
```

**CPU bottleneck?**
Reduce threads if CPU usage is 100%:
```json
{
  "threads": 8
}
```

### Hardware-Specific Recommendations

| GPU VRAM | Batch | Ubatch | Notes |
|----------|-------|--------|-------|
| 8GB      | 2048  | 512    | Conservative |
| 12GB     | 4096  | 1024   | Balanced |
| 16GB     | 8192  | 2048   | Aggressive (recommended) |
| 24GB     | 16384 | 4096   | Maximum performance |

### Model-Specific Settings

These settings are optimized for **Q4_K_M quantization**. Other quantizations:

- **Q8_0**: Reduce batch by 30% (e.g., 8192 → 5632)
- **Q5_K_M**: Reduce batch by 20% (e.g., 8192 → 6553)
- **Q2_K**: Can increase batch by 50% (e.g., 8192 → 12288)

### Monitoring

Check VRAM usage:
```bash
node scripts/remote-helper.js exec "nvidia-smi"
```

Check tokens/sec in real-time:
```bash
node scripts/remote-helper.js logs
# Look for "tokens per second" in output
```

Web UI shows live tokens/sec during streaming responses.
