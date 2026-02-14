const express = require("express");
const fs = require("fs");
const path = require("path");
const { loadModels } = require("../helpers/config");

const router = express.Router();

/**
 * GET /v1/models - List all available models
 * Returns OpenAI-compatible model list
 */
router.get("/v1/models", (req, res) => {
  try {
    const modelsConfig = loadModels();

    const models = modelsConfig.models || modelsConfig["llama-models"] || {};

    // Convert to OpenAI format
    const modelList = Object.keys(models).map(id => {
      const modelType = models[id].type || "llama-cpp";
      let ownedBy = "llama-cpp";
      if (modelType === "remote") ownedBy = "remote-api";
      else if (modelType === "whisper-cpp") ownedBy = "whisper-cpp";
      
      return {
        id,
        object: "model",
        created: Date.now(),
        owned_by: ownedBy
      };
    });

    // Add lols-smart if configured (virtual routing model)
    if (modelsConfig["lols-smart"]) {
      modelList.push({
        id: "lols-smart",
        object: "model",
        created: Date.now(),
        owned_by: "lols-router"
      });
    }

    res.json({
      object: "list",
      data: modelList
    });
  } catch (err) {
    console.error("[models] ERROR:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

module.exports = router;
