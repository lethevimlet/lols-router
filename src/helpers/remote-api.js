const { fetch } = require("undici");

const enableLog = true;
function log() {
  if (!enableLog) return;
  console.log("[remote-api]", ...arguments);
}

/**
 * Resolve environment variables in string (e.g., "${OPENAI_API_KEY}")
 */
function resolveEnvVars(str) {
  if (typeof str !== "string") return str;
  return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

/**
 * Proxy a chat completion request to a remote API
 * @param {object} modelConfig - Model configuration from models.json
 * @param {object} payload - Request body
 * @param {object} options - Additional options (signal, etc.)
 * @returns {Promise<Response>} - Undici fetch response
 */
async function proxyToRemoteAPI(modelConfig, payload, options = {}) {
  const endpoint = resolveEnvVars(modelConfig.endpoint);
  const apiKey = resolveEnvVars(modelConfig.apiKey);
  
  log("Proxying to:", endpoint);
  log("Remote model:", modelConfig.model);

  // Build headers
  const headers = {
    "content-type": "application/json",
    ...(modelConfig.headers || {})
  };

  // Add Authorization if apiKey is present
  if (apiKey) {
    headers["authorization"] = `Bearer ${apiKey}`;
  }

  // Override model in payload with the configured remote model
  const remotePayload = {
    ...payload,
    model: modelConfig.model
  };

  log("Sending payload with model:", remotePayload.model);

  // Make the request
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(remotePayload),
    signal: options.signal
  });

  log("Response status:", response.status, response.statusText);

  return response;
}

module.exports = { proxyToRemoteAPI };
