const fs = require("fs");
const path = require("path");
const { execa } = require("execa");
const { startLlama, isLlamaOnPort } = require("./llama");
const { createLogger } = require("./logger");
const { loadModels } = require("./config");

const log = createLogger("router-manager");

/**
 * Kill any process running on the specified port
 */
async function killPort(port) {
  try {
    // Try lsof first (works on macOS and some Linux)
    const { stdout } = await execa("lsof", ["-ti", `:${port}`]);
    const pids = stdout.trim().split("\n").filter(Boolean);
    
    if (pids.length > 0) {
      log.log("Killing existing processes on port", port, "PIDs:", pids.join(", "));
      for (const pid of pids) {
        try {
          await execa("kill", ["-9", pid]);
        } catch (err) {
          log.warn("Failed to kill PID", pid, ":", err.message);
        }
      }
      // Wait a bit for processes to die
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (err) {
    // lsof might not exist or port might not be in use
    // Try fuser as fallback (common on Linux)
    try {
      await execa("fuser", ["-k", `${port}/tcp`]);
      log.log("Killed process on port", port, "using fuser");
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err2) {
      // Port probably not in use, which is fine
      log.debug("No process to kill on port", port);
    }
  }
}

let routerProc = null;
let routerConfig = null;

/**
 * Start the routing llama.cpp instance
 * This is a dedicated small model that runs permanently for fast routing decisions
 */
async function startRouter() {
  const modelsConfig = loadModels();

  const routerSettings = modelsConfig.router;
  if (!routerSettings) {
    log.warn("No router config found in models.json");
    return;
  }

  const models = modelsConfig.models || modelsConfig["llama-models"] || {};
  const routerModelName = routerSettings.model;
  const routerPort = routerSettings.port;

  const modelConfig = models[routerModelName];
  if (!modelConfig) {
    log.error("Router model not found:", routerModelName);
    return;
  }

  routerConfig = {
    modelName: routerModelName,
    port: routerPort,
    config: modelConfig
  };

  log.info("Starting routing model:", routerModelName, "on port", routerPort);

  // Kill any existing process on this port
  await killPort(routerPort);

  // Check if already running (shouldn't be after kill, but check anyway)
  if (await isLlamaOnPort(routerPort)) {
    log.info("Router already running on port", routerPort);
    return;
  }

  // Start the router
  const routerStartConfig = {
    repo: modelConfig.repo,
    file: modelConfig.file,
    port: routerPort
  };
  
  // Add context size if specified in router settings
  if (routerSettings.context) {
    routerStartConfig.context = routerSettings.context;
    log.info("Router context size:", routerSettings.context);
  }
  
  routerProc = startLlama(routerStartConfig);

  log.info("Routing model started");

  // Wait for it to be ready
  await waitForRouter(routerPort);
  log.success("Routing model ready on port", routerPort);
  
  // Register router model in global registry for metrics
  if (routerProc.pid && global.modelRegistry) {
    global.modelRegistry.set(routerProc.pid, {
      modelName: routerModelName + " (router)",
      port: routerPort,
      category: "router"
    });
    log.success("Registered router PID:", routerProc.pid);
  }
}

async function waitForRouter(port, timeoutMs = 60000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await isLlamaOnPort(port)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Router timeout waiting for ready");
}

function getRouterPort() {
  if (!routerConfig) {
    throw new Error("Router not initialized");
  }
  return routerConfig.port;
}

function isRouterRunning() {
  return routerConfig !== null;
}

module.exports = { startRouter, getRouterPort, isRouterRunning };
