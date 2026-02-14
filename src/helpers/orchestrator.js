const fs = require("fs");
const path = require("path");
const { fetch } = require("undici");
const { startLlama, stopLlama, waitReady: waitReadyLlama } = require("./llama");
const { startWhisper, stopWhisper, waitReady: waitReadyWhisper, isWhisperOnPort } = require("./whisper");
const { createLogger } = require("./logger");
const { loadModels } = require("./config");

const log = createLogger("orch");

const modelsConfig = loadModels();

// Support both old "llama-models" key and new "models" key for backward compatibility
const models = modelsConfig.models || modelsConfig["llama-models"] || {};

let current = null;

/* Simple mutex */
let locked = false;
const waiters = [];

function acquire() {
  if (!locked) {
    locked = true;
    return Promise.resolve();
  }
  return new Promise(resolve => waiters.push(resolve));
}

function release() {
  const next = waiters.shift();
  if (next) return next();
  locked = false;
}

function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("timeout: " + label)), ms);
    })
  ]);
}

async function isLlamaOnPort(port) {
  try {
    const r = await fetch("http://127.0.0.1:" + port + "/v1/models", { method: "GET" });
    return r.ok;
  } catch {
    return false;
  }
}

async function withGpu(fn) {
  await acquire();
  log.debug("lock acquired");
  try {
    // Increased timeout to 6 minutes to accommodate large model loading
    return await withTimeout(Promise.resolve().then(fn), 360000, "gpu_task");
  } finally {
    release();
    log.debug("lock released");
  }
}

async function ensureModel(modelName, modelConfig) {
  const model = modelConfig || models[modelName];
  if (!model) throw new Error("unknown model: " + modelName);

  // Remote models don't need GPU orchestration
  if (model.type === "remote") {
    log.info("remote model detected:", modelName, "- skipping GPU orchestration");
    current = {
      name: modelName,
      type: "remote",
      config: model
    };
    
    // Broadcast model change
    if (global.broadcastModelStatus) {
      global.broadcastModelStatus();
    }
    
    return;
  }

  // Check if already running the same model
  if (current && current.name === modelName && current.type !== "remote") {
    return;
  }

  /* if switching away, stop only if we own it */
  if (current && current.owned && current.proc) {
    const stopType = current.type === "whisper-cpp" ? "whisper" : "llama";
    log.log(`stopping owned ${stopType}:`, current.name);
    
    const stopFn = current.type === "whisper-cpp" ? stopWhisper : stopLlama;
    await withTimeout(stopFn(current.proc), 30000, `stop${stopType}`);
  }

  const modelType = model.type || "llama-cpp"; // Default to llama-cpp for backward compatibility

  // Check if already running on port (adopt existing process)
  const checkFn = modelType === "whisper-cpp" ? isWhisperOnPort : isLlamaOnPort;
  if (await checkFn(model.port)) {
    log.info(`adopting existing ${modelType} on port`, model.port, "as", modelName);
    current = {
      name: modelName,
      type: modelType,
      port: model.port,
      owned: false,
      proc: null
    };
    
    // Broadcast model change
    if (global.broadcastModelStatus) {
      global.broadcastModelStatus();
    }
    
    return;
  }

  // Start new model process
  log.info(`starting ${modelType}:`, modelName, "port", model.port);

  let proc;
  let waitReadyFn;

  if (modelType === "whisper-cpp") {
    // Whisper model
    const whisperConfig = {
      file: model.file,
      port: model.port,
      language: model.language || "auto",
      threads: model.threads || 4
    };
    
    proc = startWhisper(whisperConfig);
    waitReadyFn = waitReadyWhisper;
  } else {
    // LLM model (llama-cpp)
    const llamaConfig = {
      repo: model.repo,
      file: model.file,
      port: model.port
    };
    
    // Add context size if specified
    if (model.context) {
      llamaConfig.context = model.context;
      log.info("context size:", model.context);
    }
    
    // Add mmproj for vision models
    if (model.mmproj) {
      llamaConfig.mmproj = model.mmproj;
      log.info("vision model detected, using mmproj:", model.mmproj);
    }
    
    // Pass performance settings
    if (model.performance) {
      llamaConfig.performance = model.performance;
      log.info("performance settings:", JSON.stringify(model.performance));
    }
    
    proc = startLlama(llamaConfig);
    waitReadyFn = waitReadyLlama;
  }

  // Increased timeout to 5 minutes for large model downloads (e.g., 14B models)
  await withTimeout(waitReadyFn(model.port), 300000, "waitReady");

  current = {
    name: modelName,
    type: modelType,
    port: model.port,
    owned: true,
    proc,
    config: model
  };

  // Register model in global registry for metrics
  if (proc.pid && global.modelRegistry) {
    global.modelRegistry.set(proc.pid, {
      modelName: modelName,
      port: model.port,
      category: modelType === "whisper-cpp" ? "transcription" : null
    });
    log.success("registered model PID:", proc.pid, "->", modelName);
  }

  log.success("ready:", modelName, "port", model.port);
  
  // Broadcast model change
  if (global.broadcastModelStatus) {
    global.broadcastModelStatus();
  }
}

function getCurrentPort() {
  if (!current) throw new Error("no model running");
  return current.port;
}

function getCurrentModel() {
  if (!current) throw new Error("no model running");
  return current;
}

module.exports = { withGpu, ensureModel, getCurrentPort, getCurrentModel };
