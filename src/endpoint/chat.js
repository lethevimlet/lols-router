const express = require("express");
const { selectModel } = require("../helpers/model-router");
const { withGpu, ensureModel, getCurrentPort, getCurrentModel } = require("../helpers/orchestrator");
const { proxyToRemoteAPI } = require("../helpers/remote-api");
const config = require("../helpers/config");
const { resolveSystemPrompt } = config;
const { fetch } = require("undici");
const { truncateContext } = require("../helpers/context-truncate");

const router = express.Router();

router.post("/v1/chat/completions", async (req, res) => {
  const rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const t0 = Date.now();

  function log() {
    if (!global.ENABLE_LOGGING) return;
    const args = Array.from(arguments);
    console.log("[chat]", rid, "t+" + (Date.now() - t0) + "ms", ...args);
    
    // Broadcast to WebSocket clients
    if (global.broadcastLog) {
      global.broadcastLog("chat", rid, "t+" + (Date.now() - t0) + "ms", ...args);
    }
  }

  try {
    // Log clear request summary for web UI
    log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log(`→ POST /v1/chat/completions`);
    log(`Headers: Content-Type: ${req.get('Content-Type') || 'none'}`);
    log(`Payload: ${JSON.stringify(req.body, null, 2)}`);
    log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    log("body keys:", Object.keys(req.body || {}));
    log("body.stream:", !!(req.body && req.body.stream));
    log("requested model:", req.body && req.body.model || "(none - will use lols-smart)");

    log("calling selectModel...");
    let plan;
    try {
      plan = await selectModel(req.body);
      log("selectModel -> selected:", plan.model);
      if (plan.category) {
        log("routing category:", plan.category);
        
        // Broadcast category to WebSocket clients
        if (global.broadcastCategoryStatus) {
          global.broadcastCategoryStatus(plan.category, plan.model);
        }
      }
    } catch (err) {
      // Model selection errors are client errors (e.g., unknown model)
      log("selectModel error:", err.message);
      return res.status(400).json({ error: err.message || String(err) });
    }

    const modelType = plan.config?.type || "llama-cpp";
    log("model type:", modelType);

    // Prepare payload
    const payload = { ...req.body };

    // Context truncation enabled with 32k limit for Hermes
    const maxContextTokens = 24000; // Leave room for response (8k tokens, model has 32k total)
    if (payload.messages && payload.messages.length > 0) {
      const result = truncateContext(payload.messages, maxContextTokens);
      const totalTokens = result.stats.systemTokens + result.stats.conversationTokens;
      if (result.stats.removed > 0) {
        log(`context truncated: removed ${result.stats.removed} messages, ~${totalTokens} tokens (limit: ${maxContextTokens})`);
      } else {
        log(`context within limit: ~${totalTokens} tokens (limit: ${maxContextTokens})`);
      }
      payload.messages = result.messages;
    }
    
    // Apply max_tokens: use the LARGER of request value or model config
    const requestedMaxTokens = payload.max_tokens || payload.n_predict || 0;
    const modelMaxTokens = plan.config?.maxTokens || 2000;
    
    if (requestedMaxTokens < modelMaxTokens) {
      payload.max_tokens = modelMaxTokens;
      log("max_tokens set to " + modelMaxTokens + " (model config overrides request=" + requestedMaxTokens + ")");
    } else if (requestedMaxTokens > 0) {
      payload.max_tokens = requestedMaxTokens;
      log("max_tokens=" + requestedMaxTokens + " (from request, higher than model config=" + modelMaxTokens + ")");
    } else {
      payload.max_tokens = modelMaxTokens;
      log("max_tokens=" + modelMaxTokens + " (defaulted from model config)");
    }

    // System Prompt Priority:
    // 1. User-provided system message (messages[0] with role="system") - HIGHEST (if config allows)
    // 2. Category-level systemPromptPath/systemPrompt (from lols-smart config)
    // 3. Model-level systemPromptPath/systemPrompt (from models.json) - LOWEST
    
    const ignoreRoleSystem = config?.systemPrompt?.ignoreRoleSystem || false;
    let userProvidedSystemPrompt = null;
    let systemPromptSource = null; // Track source for UI display
    let actualSystemPrompt = null; // Track actual prompt used
    
    if (payload.messages && Array.isArray(payload.messages) && payload.messages.length > 0) {
      // Check if first message is a system prompt
      if (payload.messages[0].role === "system") {
        const detectedPrompt = payload.messages[0].content;
        
        if (ignoreRoleSystem) {
          // Config says to ignore user system prompts - strip them
          log("user-provided system prompt detected but IGNORED (config: ignoreRoleSystem=true)");
          payload.messages = payload.messages.filter(msg => msg.role !== "system");
        } else {
          // Accept user-provided system prompt
          userProvidedSystemPrompt = detectedPrompt;
          actualSystemPrompt = detectedPrompt;
          systemPromptSource = "user-provided";
          log("user-provided system prompt detected (length: " + userProvidedSystemPrompt.length + " chars)");
        }
      }
    }
    
    // If no user-provided system prompt (or ignored), inject configured system prompt
    if (!userProvidedSystemPrompt && payload.messages && Array.isArray(payload.messages)) {
      const systemPrompt = plan.categorySystemPrompt || resolveSystemPrompt(plan.config);
      
      if (systemPrompt) {
        systemPromptSource = plan.categorySystemPrompt ? "category-level" : "model-level";
        actualSystemPrompt = systemPrompt;
        log("injecting system prompt:", systemPromptSource);
        payload.messages = [
          { role: "system", content: systemPrompt },
          ...payload.messages
        ];
      } else {
        systemPromptSource = "none";
        log("no system prompt configured");
      }
    } else if (userProvidedSystemPrompt) {
      log("using user-provided system prompt (priority: highest)");
    }
    
    // Broadcast actual system prompt to web UI
    if (global.broadcastSystemPromptUsed && actualSystemPrompt) {
      global.broadcastSystemPromptUsed(actualSystemPrompt, systemPromptSource);
    }

    // Get timeout from custom header, model config, or use default
    const headerTimeout = parseInt(req.headers['x-request-timeout']);
    const modelTimeout = plan.config?.timeout;
    const timeoutSeconds = headerTimeout || modelTimeout || 30;
    const timeoutMs = timeoutSeconds * 1000;
    const timeoutSource = headerTimeout ? "header" : (modelTimeout ? "model config" : "fallback");
    log("request timeout:", timeoutSeconds + "s (" + timeoutSource + ")");

    const controller = new AbortController();
    const timer = setTimeout(() => {
      log(`ABORT upstream after ${timeoutSeconds}s`);
      controller.abort();
    }, timeoutMs);

    req.on("close", () => {
      log("client closed; abort upstream");
      controller.abort();
    });

    let upstream;

    if (modelType === "remote") {
      // Remote API - proxy directly without GPU orchestration
      log("proxying to remote API");
      upstream = await proxyToRemoteAPI(plan.config, payload, {
        signal: controller.signal
      });
    } else {
      // Local llama-cpp - use GPU orchestration
      log("waiting for withGpu/ensureModel...");
      await withGpu(async () => {
        log("inside gpu lock: ensureModel begin", plan.model);
        await ensureModel(plan.model, plan.config);
        log("inside gpu lock: ensureModel done", plan.model);
      });
      log("passed withGpu/ensureModel");

      const port = getCurrentPort();
      log("current port:", port);

      const url = "http://127.0.0.1:" + port + "/v1/chat/completions";
      log("fetch ->", url);

      upstream = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    }

    log("upstream status:", upstream.status, upstream.statusText);

    if (payload.stream) {
      log("streaming response");
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive"
      });

      const reader = upstream.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }

      clearTimeout(timer);
      log("stream done");
      return res.end();
    }

    log("reading upstream body...");
    const text = await upstream.text();
    clearTimeout(timer);
    log("upstream body length:", text.length);

    if (!upstream.ok) {
      log("upstream error");
      return res.status(502).json({
        error: "upstream error",
        status: upstream.status,
        body: text.slice(0, 2000)
      });
    }

    log("returning json");
    res.json(JSON.parse(text));
  } catch (err) {
    log("ERROR:", err && err.stack ? err.stack : String(err));
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || String(err) });
    }
  }
});

module.exports = router;
