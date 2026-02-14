const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const config = require("./helpers/config");
const { banner, createLogger } = require("./helpers/logger");
const { cleanupModelPorts } = require("./helpers/cleanup");
const { startRouter } = require("./helpers/router-manager");
const { getSystemMetrics } = require("./helpers/system-metrics");
const { startPeriodicCleanup } = require("./helpers/temp-cleanup");
const chat = require("./endpoint/chat");
const audio = require("./endpoint/audio");
const models = require("./endpoint/models");
const cleanup = require("./endpoint/cleanup");
const logging = require("./endpoint/logging");
const wildcard = require("./endpoint/wildcard");
const test = require("./endpoint/test");

// Global settings from config
global.testModel = null;
global.ENABLE_LOGGING = config.logging.enabled;
global.DEBUG = config.logging.debug;
global.config = config; // Make config available globally

// Global model registry: PID -> { modelName, port, category }
global.modelRegistry = new Map();

const log = createLogger("server");

// Startup sequence
(async () => {
  banner("LOLS-ROUTER STARTUP");
  
  // Log configuration
  log.info(`Server: ${config.server.host}:${config.server.port}`);
  log.info(`Logging: ${config.logging.enabled ? 'enabled' : 'disabled'} (debug: ${config.logging.debug})`);
  
  // Step 1: Clean up any residual model processes (if enabled)
  if (config.cleanup.enabled) {
    log.info("Cleaning up residual model processes...");
    await cleanupModelPorts();
  } else {
    log.info("Cleanup disabled in config");
  }
  
  // Step 2: Start routing model (if enabled)
  if (config.router.enabled) {
    log.info("Starting routing model...");
    startRouter().catch(err => {
      log.error("Failed to start routing model:", err);
      log.warn("Will fall back to default routing");
    });
  } else {
    log.info("Router model disabled in config");
  }
})();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket clients
const wsClients = new Set();

// WebSocket connection handler
const wsLog = createLogger("ws");
wss.on("connection", (ws) => {
  wsLog.success("Client connected");
  wsClients.add(ws);
  
  // Send current model status immediately
  broadcastModelStatus();
  
  ws.on("close", () => {
    wsLog.info("Client disconnected");
    wsClients.delete(ws);
  });
  
  ws.on("error", (error) => {
    wsLog.error("Error:", error);
  });
});

// Broadcast model status to all connected clients
function broadcastModelStatus() {
  const orchestrator = require("./helpers/orchestrator");
  const { resolveSystemPrompt } = require("./helpers/config");
  
  try {
    const current = orchestrator.getCurrentModel();
    const modelConfig = current.config || {};
    
    // Get system prompt (handles both systemPromptPath and systemPrompt)
    const systemPrompt = resolveSystemPrompt(modelConfig);
    
    const message = JSON.stringify({
      type: "modelStatus",
      model: current.name,
      modelType: current.type,
      port: current.port,
      context: modelConfig.context || null,
      systemPrompt: systemPrompt || null,
      maxTokens: modelConfig.maxTokens || null,
      timeout: modelConfig.timeout || null,
      temperature: modelConfig.temperature || null,
      topP: modelConfig.topP || null
    });
    
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } catch (err) {
    // No model running yet
    const message = JSON.stringify({
      type: "modelStatus",
      model: null
    });
    
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Broadcast category status to all connected clients
function broadcastCategoryStatus(category, model) {
  // Update category in model registry for all instances of this model
  if (global.modelRegistry) {
    for (const [pid, info] of global.modelRegistry.entries()) {
      if (info.modelName === model || info.modelName.includes(model)) {
        info.category = category;
      }
    }
  }
  
  const message = JSON.stringify({
    type: "categoryStatus",
    category: category,
    model: model
  });
  
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast system metrics to all connected clients
async function broadcastSystemMetrics() {
  try {
    const metrics = await getSystemMetrics();
    const message = JSON.stringify({
      type: "systemMetrics",
      metrics: metrics
    });
    
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } catch (err) {
    wsLog.error("Error broadcasting metrics:", err.message);
  }
}

// Broadcast log messages to all connected clients
function broadcastLog(source, ...messages) {
  if (!global.ENABLE_LOGGING) return;
  
  const logMessage = JSON.stringify({
    type: "log",
    source: source,
    message: messages.map(m => typeof m === 'object' ? JSON.stringify(m) : String(m)).join(' '),
    timestamp: Date.now()
  });
  
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(logMessage);
    }
  });
}

// Broadcast actual system prompt used in request (with source)
function broadcastSystemPromptUsed(systemPrompt, source) {
  const message = JSON.stringify({
    type: "systemPromptUsed",
    systemPrompt: systemPrompt,
    source: source // "user-provided", "category-level", "model-level", or "none"
  });
  
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Make broadcast functions available globally
global.broadcastModelStatus = broadcastModelStatus;
global.broadcastCategoryStatus = broadcastCategoryStatus;
global.broadcastSystemMetrics = broadcastSystemMetrics;
global.broadcastLog = broadcastLog;
global.broadcastSystemPromptUsed = broadcastSystemPromptUsed;

// Broadcast system metrics (if enabled)
if (config.systemMetrics.enabled) {
  setInterval(broadcastSystemMetrics, config.systemMetrics.updateInterval);
  log.info(`System metrics broadcasting every ${config.systemMetrics.updateInterval}ms`);
}

app.use(express.json({ limit: "10mb" }));

// Accept any API key without validation (for OpenClaw compatibility)
// OpenClaw can send Authorization headers, but we don't actually check them
app.use((req, res, next) => {
  // Just accept any Authorization header and move on
  // This makes lols-router compatible with clients that expect auth
  next();
});

// Serve static files from webapp directory
app.use(express.static(path.join(__dirname, "webapp")));

// Order matters: specific routes before wildcards
app.use(chat);      // /v1/chat/completions (specific)
app.use(audio);     // /v1/audio/transcriptions (specific)
app.use(models);    // /v1/models (specific)
app.use(cleanup);   // /v1/cleanup (specific)
app.use(logging);   // /v1/logging (specific)
app.use(wildcard);  // /v1/* (catch-all for other endpoints)
app.use(test);      // /test/*

server.listen(config.server.port, config.server.host, () => {
  log.success(`Listening on http://${config.server.host}:${config.server.port}`);
  log.success(`Web interface: http://localhost:${config.server.port}/`);
  
  // Start periodic temp file cleanup (every 30 min, files older than 60 min)
  startPeriodicCleanup(30, 60);
  
  banner("SERVER READY");
});
