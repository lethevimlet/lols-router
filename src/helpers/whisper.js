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

function getWhisperBin() {
  // Priority: config.json > environment variable > default
  const path = config.whisper?.bin || process.env.WHISPER_BIN || process.env.HOME + "/whisper.cpp/build/bin/whisper-server";
  return expandTilde(path);
}

function getWhisperModels() {
  // Priority: config.json > environment variable > default
  const path = config.whisper?.models || process.env.WHISPER_MODELS || process.env.HOME + "/whisper.cpp/models";
  return expandTilde(path);
}

function startWhisper(cfg) {
  const WHISPER_BIN = getWhisperBin();
  
  // Check if binary exists before attempting to start
  if (!fs.existsSync(WHISPER_BIN)) {
    throw new Error(`whisper-server binary not found at: ${WHISPER_BIN}`);
  }
  
  const modelsDir = getWhisperModels();
  const modelPath = `${modelsDir}/${cfg.file}`;
  
  // Check if model file exists
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Whisper model not found at: ${modelPath}`);
  }
  
  const args = [
    "--host", "127.0.0.1",
    "--port", String(cfg.port),
    "--model", modelPath
  ];
  
  // GPU configuration (enabled by default)
  const gpuEnabled = config.whisper?.gpu?.enabled !== false; // Default: true
  const gpuDevice = config.whisper?.gpu?.device || 0;
  
  if (!gpuEnabled) {
    args.push("--no-gpu");
    console.log("[whisper] GPU disabled via config");
  } else {
    args.push("--device", String(gpuDevice));
    console.log("[whisper] GPU enabled, device:", gpuDevice);
  }
  
  // Add language if specified
  if (cfg.language && cfg.language !== "auto") {
    args.push("--language", cfg.language);
  }
  
  // Add thread count if specified
  if (cfg.threads) {
    args.push("--threads", String(cfg.threads));
  }
  
  console.log("[whisper] Starting whisper-server with model:", cfg.file);
  console.log("[whisper] Model path:", modelPath);
  console.log("[whisper] Port:", cfg.port);
  
  const proc = execa(
    WHISPER_BIN,
    args,
    {
      stdio: "inherit",
      env: {
        ...process.env
      }
    }
  );
  
  // Handle process errors to prevent uncaught exceptions
  proc.catch(err => {
    console.error("[whisper] Process error:", err.message);
  });
  
  return proc;
}

async function stopWhisper(proc) {
  proc.kill("SIGTERM");
  try {
    await proc;
  } catch {}
}

async function waitReady(port) {
  const base = "http://127.0.0.1:" + port;

  for (;;) {
    try {
      const r = await fetch(base + "/health", { method: "GET" });
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }
}

async function isWhisperOnPort(port) {
  try {
    const r = await fetch("http://127.0.0.1:" + port + "/health", {
      method: "GET"
    });
    return r.ok;
  } catch {
    return false;
  }
}

module.exports = { startWhisper, stopWhisper, waitReady, isWhisperOnPort };
