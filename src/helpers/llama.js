const { execa } = require("execa");
const { fetch } = require("undici");
const fs = require("fs");
const config = require("./config");

function expandTilde(filepath) {
  if (filepath && filepath.startsWith("~/")) {
    return filepath.replace("~", process.env.HOME || process.env.USERPROFILE);
  }
  return filepath;
}

function getLlamaBin() {
  // Priority: config.json > environment variable > default
  const path = config.llama?.bin || process.env.LLAMA_BIN || process.env.HOME + "/llama.cpp/build/bin/llama-server";
  return expandTilde(path);
}

function getLlamaCache() {
  // Priority: config.json > environment variable > default
  const path = config.llama?.cache || process.env.LLAMA_CACHE || process.env.HOME + "/.cache/llama.cpp";
  return expandTilde(path);
}

function startLlama(cfg) {
  const LLAMA_BIN = getLlamaBin();
  
  // Check if binary exists before attempting to start
  if (!fs.existsSync(LLAMA_BIN)) {
    throw new Error(`llama-server binary not found at: ${LLAMA_BIN}`);
  }
  
  const args = [
    "--host", "127.0.0.1",
    "--port", String(cfg.port),
    "--hf-repo", cfg.repo,
    "--hf-file", cfg.file,
    "--jinja" // Enable built-in chat template for function calling support
  ];
  
  // Add context size if specified
  if (cfg.context) {
    args.push("-c", String(cfg.context));
    console.log("[llama] Context size:", cfg.context);
    
    // Override model metadata to force slots to use full context
    const overrides = [
      `llama.context_length=int:${cfg.context}`,
      `qwen2.context_length=int:${cfg.context}`
    ].join(",");
    args.push("--override-kv", overrides);
    console.log("[llama] Overriding model context metadata to:", cfg.context);
  }
  
  // Enable prompt caching with larger limit for better cache hits
  // Default is 8GB, but we can increase it if needed
  args.push("--cache-ram", "16384"); // 16GB cache (more = better hit rate)
  console.log("[llama] Prompt cache size:", "16GB");
  
  // Sampling parameters (model-specific defaults)
  if (cfg.temperature !== undefined) {
    args.push("--temp", String(cfg.temperature));
    console.log("[llama] Temperature:", cfg.temperature);
  }
  
  if (cfg.topP !== undefined) {
    args.push("--top-p", String(cfg.topP));
    console.log("[llama] Top-p:", cfg.topP);
  }
  
  if (cfg.minP !== undefined) {
    args.push("--min-p", String(cfg.minP));
    console.log("[llama] Min-p:", cfg.minP);
  }
  
  if (cfg.repeatPenalty !== undefined) {
    args.push("--repeat-penalty", String(cfg.repeatPenalty));
    console.log("[llama] Repeat penalty:", cfg.repeatPenalty);
  }
  
  // Add mmproj for vision models (use cached file path)
  if (cfg.mmproj) {
    const cacheDir = getLlamaCache();
    const repoSlug = cfg.repo.replace(/\//g, "_");
    const mmprojFile = cfg.mmproj.replace(/\//g, "_");
    const mmprojPath = `${cacheDir}/${repoSlug}_${mmprojFile}`;
    
    // Check if mmproj file exists in cache
    if (fs.existsSync(mmprojPath)) {
      args.push("--mmproj");
      args.push(mmprojPath);
      console.log("[llama] Starting vision model with mmproj:", mmprojPath);
    } else {
      console.log("[llama] Warning: mmproj file not found in cache:", mmprojPath);
      console.log("[llama] Please download it manually or the model may not support images");
    }
  }
  
  // GPU configuration (enabled by default)
  const gpuEnabled = config.llama?.gpu?.enabled !== false; // Default: true
  const gpuLayers = config.llama?.gpu?.layers ?? -1; // Default: -1 (all layers)
  const gpuDevice = config.llama?.gpu?.device ?? 0; // Default: 0
  
  if (!gpuEnabled) {
    args.push("-ngl", "0");
    console.log("[llama] GPU disabled via config (CPU-only mode)");
  } else {
    args.push("-ngl", String(gpuLayers));
    args.push("--main-gpu", String(gpuDevice));
    console.log("[llama] GPU enabled, layers:", gpuLayers === -1 ? "all" : gpuLayers, "device:", gpuDevice);
  }
  
  // Performance optimization parameters
  if (cfg.performance) {
    const perf = cfg.performance;
    
    // Flash attention (for Ada Lovelace and newer GPUs)
    if (perf.flashAttention && gpuEnabled) {
      args.push("--flash-attn", "on");
      console.log("[llama] Flash attention enabled");
    }
    
    // Batch size (affects throughput)
    if (perf.batch) {
      args.push("-b", String(perf.batch));
      console.log("[llama] Batch size:", perf.batch);
    }
    
    // Micro-batch size (affects memory and speed)
    if (perf.ubatch) {
      args.push("-ub", String(perf.ubatch));
      console.log("[llama] Micro-batch size:", perf.ubatch);
    }
    
    // CPU threads
    if (perf.threads) {
      args.push("-t", String(perf.threads));
      console.log("[llama] CPU threads:", perf.threads);
    }
    
    // Parallel request slots
    if (perf.parallel) {
      args.push("-np", String(perf.parallel));
      console.log("[llama] Parallel slots:", perf.parallel);
    }
    
    // Continuous batching (enabled by default in newer llama.cpp)
    if (perf.contBatching) {
      args.push("--cont-batching");
      console.log("[llama] Continuous batching enabled");
    }
    
    // Cache reuse via KV shifting: helps when OpenClaw sends growing conversation history
    // Minimum chunk size to attempt reusing from cache (default: 0 = disabled)
    // Setting to 2048 means: reuse cache if at least 2048 tokens match from prefix
    args.push("--cache-reuse", "2048");
    console.log("[llama] Cache reuse enabled (min chunk: 2048 tokens)");
    
    // KV cache type for keys (f16 saves memory vs f32)
    if (perf.cacheTypeK) {
      args.push("--cache-type-k", perf.cacheTypeK);
      console.log("[llama] KV cache type (keys):", perf.cacheTypeK);
    }
    
    // KV cache type for values (f16 saves memory vs f32)
    if (perf.cacheTypeV) {
      args.push("--cache-type-v", perf.cacheTypeV);
      console.log("[llama] KV cache type (values):", perf.cacheTypeV);
    }
  }
  
  const proc = execa(
    LLAMA_BIN,
    args,
    {
      stdio: "inherit",
      env: {
        ...process.env,
        LLAMA_CACHE: getLlamaCache()
      }
    }
  );
  
  // Handle process errors to prevent uncaught exceptions
  proc.catch(err => {
    console.error("[llama] Process error:", err.message);
  });
  
  return proc;
}

async function stopLlama(proc) {
  proc.kill("SIGTERM");
  try {
    await proc;
  } catch {}
}

async function waitReady(port) {
  const base = "http://127.0.0.1:" + port;

  for (;;) {
    try {
      const r = await fetch(base + "/v1/models", { method: "GET" });
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }
}

async function isLlamaOnPort(port) {
  try {
    const r = await fetch("http://127.0.0.1:" + port + "/v1/models", {
      method: "GET"
    });
    return r.ok;
  } catch {
    return false;
  }
}

module.exports = { startLlama, stopLlama, waitReady, isLlamaOnPort };
