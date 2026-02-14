const express = require("express");
const { getModelConfig } = require("../helpers/model-router");
const { proxyToRemoteAPI } = require("../helpers/remote-api");

const router = express.Router();

const enableLog = true;
function log() {
  if (!enableLog) return;
  console.log("[wildcard]", ...arguments);
}

/**
 * Wildcard proxy for all /v1/* endpoints except /v1/chat/completions
 * Handles /v1/models, /v1/embeddings, /v1/completions, etc.
 * 
 * Only proxies to remote APIs - local models don't support these endpoints
 */
router.all("/v1/*", async (req, res) => {
  const rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const t0 = Date.now();

  function logReq() {
    if (!enableLog) return;
    console.log("[wildcard]", rid, "t+" + (Date.now() - t0) + "ms", ...arguments);
  }

  try {
    logReq("entered:", req.method, req.path);

    // Extract model from request body if present
    const requestedModel = req.body?.model;
    
    if (!requestedModel) {
      logReq("no model specified - cannot proxy");
      return res.status(400).json({
        error: "model field required for this endpoint",
        message: "This endpoint requires a 'model' field in the request body"
      });
    }

    logReq("requested model:", requestedModel);

    // Get model config
    const modelConfig = getModelConfig(requestedModel);
    
    if (!modelConfig) {
      logReq("unknown model:", requestedModel);
      return res.status(400).json({
        error: `unknown model: ${requestedModel}`
      });
    }

    // Check if it's a remote model
    const modelType = modelConfig.type || "llama-cpp";
    logReq("model type:", modelType);

    if (modelType !== "remote") {
      logReq("local model - not supported for this endpoint");
      return res.status(400).json({
        error: "local models only support /v1/chat/completions",
        message: `The model '${requestedModel}' is a local llama-cpp model. Only /v1/chat/completions is supported for local models. Use a remote model for other endpoints.`
      });
    }

    // Proxy to remote API
    logReq("proxying to remote API");

    const controller = new AbortController();
    const timer = setTimeout(() => {
      logReq("ABORT upstream after 30s");
      controller.abort();
    }, 30000);

    req.on("close", () => {
      logReq("client closed; abort upstream");
      controller.abort();
    });

    // Build the full remote URL by replacing /v1/* with the endpoint path
    const endpointPath = req.path; // e.g., "/v1/embeddings"
    const baseEndpoint = modelConfig.endpoint.replace(/\/v1\/chat\/completions$/, "");
    const fullEndpoint = baseEndpoint + endpointPath;

    logReq("full endpoint:", fullEndpoint);

    // Create a modified config with the full endpoint
    const proxyConfig = {
      ...modelConfig,
      endpoint: fullEndpoint
    };

    const upstream = await proxyToRemoteAPI(proxyConfig, req.body, {
      signal: controller.signal
    });

    logReq("upstream status:", upstream.status, upstream.statusText);

    // Handle streaming responses
    if (req.body.stream) {
      logReq("streaming response");
      res.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") || "text/event-stream",
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
      logReq("stream done");
      return res.end();
    }

    // Handle non-streaming responses
    logReq("reading upstream body...");
    const text = await upstream.text();
    clearTimeout(timer);
    logReq("upstream body length:", text.length);

    if (!upstream.ok) {
      logReq("upstream error");
      return res.status(upstream.status).json({
        error: "upstream error",
        status: upstream.status,
        body: text.slice(0, 2000)
      });
    }

    logReq("returning json");
    res.status(upstream.status).json(JSON.parse(text));
  } catch (err) {
    logReq("ERROR:", err && err.stack ? err.stack : String(err));
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || String(err) });
    }
  }
});

module.exports = router;
