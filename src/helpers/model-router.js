const { fetch } = require("undici");
const { getRouterPort, isRouterRunning } = require("./router-manager");
const { loadModels, resolveSystemPrompt } = require("./config");

const modelsConfig = loadModels();

// Support both old "llama-models" key and new "models" key for backward compatibility
const models = modelsConfig.models || modelsConfig["llama-models"] || {};
const lolsSmartConfig = modelsConfig["lols-smart"] || {};
const routerConfig = modelsConfig.router || {};

const enableLog = true;
function log() {
  if (!enableLog) return;
  console.log("[model-router]", ...arguments);
}

/**
 * Build system prompt for routing model
 * Loads from router config (systemPromptPath or systemPrompt) and replaces {CATEGORIES} placeholder
 * @returns {string} System prompt
 */
function buildRouterSystemPrompt() {
  const categories = Object.keys(lolsSmartConfig);
  
  // Load router system prompt using the same pattern as category configs
  const promptTemplate = resolveSystemPrompt(routerConfig);
  
  if (!promptTemplate) {
    log("Warning: No router system prompt found in config, using fallback");
    return `You are a request classifier. Respond with ONLY ONE WORD: ${categories.join(", ")}`;
  }
  
  // Replace {CATEGORIES} placeholder with actual categories
  return promptTemplate.replace("{CATEGORIES}", categories.join(", "));
}

/**
 * Detect the category of a request using llama.cpp routing model
 * @param {object} payload - Request payload with messages, tools, etc.
 * @returns {Promise<string>} - Category from lols-smart config
 */
async function detectCategory(payload) {
  // If router not running, fallback to default
  if (!isRouterRunning()) {
    log("Router not running, using default");
    return "default";
  }

  try {
    // Extract user message
    const messages = payload.messages || [];
    const lastUserMessage = messages
      .filter(m => m.role === "user")
      .pop();
    
    if (!lastUserMessage || !lastUserMessage.content) {
      return "default";
    }

    // Extract text from content (handle both string and array formats)
    let userContent;
    if (Array.isArray(lastUserMessage.content)) {
      // OpenAI/OpenClaw multimodal format: extract all text parts
      userContent = lastUserMessage.content
        .filter(part => part.type === "text" && part.text)
        .map(part => part.text)
        .join("\n");
    } else if (typeof lastUserMessage.content === "string") {
      // Simple string format
      userContent = lastUserMessage.content;
    } else {
      return "default";
    }
    
    if (!userContent || userContent.trim().length === 0) {
      return "default";
    }
    
    log("Analyzing user message:", userContent.substring(0, 100) + (userContent.length > 100 ? "..." : ""));

    // Check for vision content (images in messages)
    // OpenAI format: content can be array with {type: "image_url", image_url: {url: "..."}} objects
    const hasImage = messages.some(msg => {
      if (!msg.content) return false;
      
      // Check if content is an array (multimodal format)
      if (Array.isArray(msg.content)) {
        return msg.content.some(part => 
          part.type === "image_url" || part.type === "image"
        );
      }
      
      return false;
    });
    
    if (hasImage) {
      log("Image content detected in request");
      return "vision";
    }

    // Note: Tool presence in payload no longer auto-selects "tools" category
    // Let the router model analyze the actual user message content instead
    // This allows proper categorization even when tools are available (e.g., OpenClaw)

    // Call routing model
    const routerPort = getRouterPort();
    const routerUrl = `http://127.0.0.1:${routerPort}/v1/chat/completions`;

    const routerPayload = {
      messages: [
        { role: "system", content: buildRouterSystemPrompt() },
        { role: "user", content: userContent }
      ],
      max_tokens: 10,
      temperature: 0.1,
      stream: false
    };

    log("Calling routing model on port", routerPort);

    const response = await fetch(routerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(routerPayload),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      log("Router returned non-ok status:", response.status);
      return "default";
    }

    const result = await response.json();
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      log("Invalid router response format");
      return "default";
    }

    const category = result.choices[0].message.content.trim().toLowerCase();
    log("Router returned category:", category);

    // Validate category exists in config
    if (lolsSmartConfig[category]) {
      return category;
    }

    log("Invalid category returned:", category, "- using default");
    return "default";

  } catch (err) {
    log("Error calling router:", err.message);
    return "default";
  }
}

async function selectModel(payload) {
  // Test override always takes precedence
  if (global.testModel) {
    return { model: global.testModel };
  }

  const requestedModel = payload && payload.model;

  // If no model specified or "lols-smart", use router logic
  if (!requestedModel || requestedModel === "lols-smart") {
    // Detect category using vLLM model (currently dummy)
    const category = await detectCategory(payload);
    log("detected category:", category);

    // Get model for this category from config, fallback to default
    const categoryConfig = lolsSmartConfig[category] || lolsSmartConfig.default || "qwen2.5-7b-instruct";
    
    // Support both string (model name) and object {model, systemPrompt, systemPromptPath}
    let selectedModel;
    let categorySystemPrompt;
    
    if (typeof categoryConfig === "string") {
      selectedModel = categoryConfig;
    } else if (typeof categoryConfig === "object" && categoryConfig.model) {
      selectedModel = categoryConfig.model;
      // Resolve system prompt with priority: systemPromptPath > systemPrompt
      categorySystemPrompt = resolveSystemPrompt(categoryConfig);
    } else {
      throw new Error(`Invalid lols-smart category config for: ${category}`);
    }
    
    log("selected model:", selectedModel, "for category:", category);
    if (categorySystemPrompt) {
      log("category has custom system prompt");
    }

    return {
      model: selectedModel,
      config: models[selectedModel],
      category, // include category in response for logging
      categorySystemPrompt // include category-level system prompt if present
    };
  }

  // Direct model selection - validate it exists in models.json
  if (!models[requestedModel]) {
    throw new Error(`unknown model: ${requestedModel}`);
  }

  return {
    model: requestedModel,
    config: models[requestedModel]
  };
}

/**
 * Get model configuration by name
 */
function getModelConfig(modelName) {
  return models[modelName];
}

module.exports = { selectModel, getModelConfig };
