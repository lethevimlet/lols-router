const fs = require('fs');
const path = require('path');

/**
 * Find and load a JSON file, checking .env directory first, then root, then src directory
 * @param {string} filename - Name of the JSON file (e.g., 'config.json', 'models.json')
 * @returns {object|null} Parsed JSON object or null if not found
 */
function loadJsonFile(filename) {
  const projectRoot = path.join(__dirname, '../..');
  
  // Priority 1: Check .env directory first (for local overrides with secrets)
  const envPath = path.join(projectRoot, '.env', filename);
  
  if (fs.existsSync(envPath)) {
    try {
      const data = fs.readFileSync(envPath, 'utf8');
      console.log(`[config] Loading ${filename} from .env directory`);
      return JSON.parse(data);
    } catch (err) {
      console.error(`[config] Failed to parse ${envPath}: ${err.message}`);
    }
  }
  
  // Priority 2: Check root directory (default location)
  const rootPath = path.join(projectRoot, filename);
  
  if (fs.existsSync(rootPath)) {
    try {
      const data = fs.readFileSync(rootPath, 'utf8');
      console.log(`[config] Loading ${filename} from root directory`);
      return JSON.parse(data);
    } catch (err) {
      console.error(`[config] Failed to parse ${rootPath}: ${err.message}`);
    }
  }
  
  // Priority 3: Fallback to src directory (backward compatibility)
  const srcPath = path.join(__dirname, '..', filename);
  
  if (fs.existsSync(srcPath)) {
    try {
      const data = fs.readFileSync(srcPath, 'utf8');
      console.log(`[config] Loading ${filename} from src directory`);
      return JSON.parse(data);
    } catch (err) {
      console.error(`[config] Failed to parse ${srcPath}: ${err.message}`);
    }
  }
  
  return null;
}

/**
 * Load and parse configuration from config.json
 */
function loadConfig() {
  const config = loadJsonFile('config.json');
  
  if (config) {
    return config;
  }
  
  console.error('[config] Failed to load config.json from .env or src directories');
  console.error('[config] Using default configuration');
  
  // Return default configuration
  return {
    server: {
      port: 3000,
      host: "0.0.0.0"
    },
    logging: {
      enabled: true,
      debug: false,
      colorOutput: true
    },
    systemMetrics: {
      enabled: true,
      updateInterval: 2000
    },
    cleanup: {
      enabled: true,
      killOrphanedProcesses: true
    },
    router: {
      enabled: true,
      model: "qwen2.5-1.5b-instruct",
      port: 3001
    },
    gpu: {
      enableMonitoring: true,
      showProcessDetails: true
    },
    webapp: {
      enabled: true,
      defaultTimeout: 30,
      defaultMaxTokens: 2000,
      streamingEnabled: true
    },
    llama: {
      bin: process.env.LLAMA_BIN || "/path/to/llama-server",
      cache: process.env.LLAMA_CACHE || "/path/to/model-cache"
    }
  };
}

/**
 * Load models.json configuration
 * @returns {object} Models configuration object
 */
function loadModels() {
  const models = loadJsonFile('models.json');
  
  if (models) {
    return models;
  }
  
  console.error('[config] Failed to load models.json from .env or src directories');
  console.error('[config] Returning empty models configuration');
  return {};
}

/**
 * Resolve a file path, supporting:
 * - Absolute paths (/path/to/file)
 * - Tilde paths (~/path/to/file)
 * - Relative paths (relative to project root)
 * @param {string} filePath - The path to resolve
 * @returns {string} Resolved absolute path
 */
function resolvePath(filePath) {
  if (!filePath) return null;
  
  // Handle tilde expansion
  if (filePath.startsWith('~/')) {
    const homeDir = require('os').homedir();
    return path.join(homeDir, filePath.slice(2));
  }
  
  // Absolute paths
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  
  // Relative paths (relative to project root)
  const projectRoot = path.join(__dirname, '../..');
  return path.join(projectRoot, filePath);
}

/**
 * Load system prompt from a file, checking .env directory first for prompts
 * @param {string} filePath - Path to the system prompt file (supports relative, absolute, and ~ paths)
 * @returns {string|null} The system prompt content, or null if file not found or error
 */
function loadSystemPromptFromFile(filePath) {
  if (!filePath) return null;
  
  try {
    const projectRoot = path.join(__dirname, '../..');
    let resolvedPath = null;
    
    // For relative paths starting with "prompts/", check .env directory first (private prompts)
    if (!filePath.startsWith('/') && !filePath.startsWith('~') && filePath.startsWith('prompts/')) {
      const envPromptPath = path.join(projectRoot, '.env', filePath);
      if (fs.existsSync(envPromptPath)) {
        resolvedPath = envPromptPath;
        console.log(`[config] Loaded system prompt from: ${resolvedPath} (private)`);
      }
    }
    
    // If not found in .env, use normal path resolution
    if (!resolvedPath) {
      resolvedPath = resolvePath(filePath);
      
      if (!fs.existsSync(resolvedPath)) {
        console.error(`[config] System prompt file not found: ${resolvedPath}`);
        return null;
      }
      
      console.log(`[config] Loaded system prompt from: ${resolvedPath}`);
    }
    
    const content = fs.readFileSync(resolvedPath, 'utf8');
    return content.trim(); // Remove leading/trailing whitespace
  } catch (err) {
    console.error(`[config] Failed to load system prompt from ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Resolve system prompt with priority: systemPromptPath > systemPrompt
 * @param {object} config - Configuration object that may contain systemPrompt and/or systemPromptPath
 * @returns {string|null} Resolved system prompt content
 */
function resolveSystemPrompt(config) {
  if (!config) return null;
  
  // Priority 1: systemPromptPath (load from file)
  if (config.systemPromptPath) {
    const promptFromFile = loadSystemPromptFromFile(config.systemPromptPath);
    if (promptFromFile) {
      return promptFromFile;
    }
    // If file loading failed, fall through to systemPrompt
  }
  
  // Priority 2: systemPrompt (inline)
  return config.systemPrompt || null;
}

// Load config once at startup
const config = loadConfig();

module.exports = config;
module.exports.loadModels = loadModels;
module.exports.loadJsonFile = loadJsonFile;
module.exports.loadSystemPromptFromFile = loadSystemPromptFromFile;
module.exports.resolveSystemPrompt = resolveSystemPrompt;
module.exports.resolvePath = resolvePath;
