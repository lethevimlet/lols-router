# PROJECT.md - Technical Architecture

## Overview

lols-router is a local LLM routing system that uses a small router model to classify requests and route them to specialized models.

## Architecture

```
Request → Router Model (0.5B) → Category Detection → Specialized Model (7B/14B) → Response
          (port 3001)              (default/code/chat/reason/vision)      (port 8027, etc.)
```

### Key Components

**`src/server.js`**
- Express HTTP server
- WebSocket for real-time UI updates
- Middleware: permissive auth, JSON parsing
- Route mounting

**`src/helpers/model-router.js`**
- Request classification logic
- Sends last user message to router model
- Returns category: default, reason, chat, code, vision
- **Ignores tool definitions** in request

**`src/helpers/orchestrator.js`**
- GPU lock management (single GPU, one model at a time)
- Model loading/unloading
- Port tracking

**`src/endpoint/chat.js`**
- Main `/v1/chat/completions` endpoint
- System prompt injection (category > model > user)
- Streams or buffers responses
- Timeout handling

**`src/helpers/llama.js`**
- llama.cpp process spawning
- Model file caching
- GPU/performance flags

## Request Flow

1. **Request arrives** at `/v1/chat/completions`
2. **Model selection** (`model-router.js`):
   - Extract last user message
   - Check for images → "vision"
   - Send to router model (port 3001) → get category
   - Look up model for category
3. **Model loading** (`orchestrator.js`):
   - Acquire GPU lock
   - Check if model already loaded
   - If different model: kill old, start new
4. **System prompt injection** (`chat.js`):
   - Priority: user-provided > category-level > model-level
   - Prepend to messages array
5. **Forward to llama-server** (http://127.0.0.1:PORT/v1/chat/completions)
6. **Stream or buffer** response back to client

## Configuration

### models.json Structure

```json
{
  "router": {
    "model": "qwen2.5-0.5b-instruct",
    "port": 3001,
    "context": 2048
  },
  "lols-smart": {
    "default": {
      "model": "qwen2.5.1-coder-7b-instruct",
      "systemPromptPath": "prompts/general-assistant.md"
    }
  },
  "models": {
    "qwen2.5.1-coder-7b-instruct": {
      "type": "llama-cpp",
      "repo": "bartowski/Qwen2.5.1-Coder-7B-Instruct-GGUF",
      "file": "Qwen2.5.1-Coder-7B-Instruct-Q4_K_M.gguf",
      "context": 131072,
      "port": 8027
    }
  }
}
```

### System Prompt Priority

1. **User-provided** (messages[0].role === "system")
   - Only if `config.systemPrompt.ignoreRoleSystem = false`
2. **Category-level** (lols-smart.<category>.systemPromptPath)
   - Loaded from prompts/ directory
3. **Model-level** (models.<model>.systemPrompt)
   - Inline in config

## Authentication

Middleware in `src/server.js` accepts any Authorization header without validation:
```javascript
app.use((req, res, next) => {
  // Just accept any Authorization header and move on
  next();
});
```

This allows compatibility with clients that expect auth (like OpenClaw) while keeping the server simple.

## Model Management

### GPU Orchestration
- Single GPU shared across all models
- Exclusive lock via `withGpu()` mutex
- Model switching: kill old llama-server, start new
- PIDs tracked in global registry

### Model Loading
- On-demand loading when category selected
- Model files cached in `~/.cache/llama.cpp/`
- Hugging Face download if not cached

### Ports
- 3000: Main API server
- 3001: Router model (permanent)
- 8020-8032: Specialized models (dynamic)

## Web UI

- Located in `src/webapp/`
- Real-time model status via WebSocket
- Features: test interface, system prompt viewer, GPU metrics
- WebSocket broadcasts: model status, logs, system prompts, metrics

## Performance

### Context Handling (OPTIMIZED 2026-02-14)

**Current Configuration:** Flash attention enabled, q4_0 KV cache for memory efficiency.

The 7B model now handles up to **128K tokens** successfully:
- 2K tokens: 0.64s (~3,125 t/s) ⚡
- 5K tokens: 3.15s (~1,590 t/s) ⚡
- 20K tokens: 6.89s (~2,901 t/s) ✅
- 128K tokens: 69.86s (~1,832 t/s) ✅

**Key optimizations applied:**
- `flashAttention: true` (enabled for performance)
- `cacheTypeK/V: "q4_0"` (quantized for memory efficiency)
- `--override-kv` in llama.cpp (forces full context in slots)
- Smaller batch sizes: batch=4096, ubatch=512
- Single slot: parallel=1, contBatching=false

**See:** `docs/OPTIMIZATION-SUCCESS.md` for full details.

### Typical Response Times
- Small context (10 messages, ~2k tokens): ~1s
- Medium (25 messages, ~5k tokens): ~3s
- Large (100 messages, ~20k tokens): ~7s
- Very large (640 messages, ~128k tokens): ~70s

Token processing speed: 1,500-3,000 tokens/sec depending on context size.

## Testing

### Test Files
- `test/openclaw-compat-test.js` - 4 tests for OpenClaw integration
- `test/openclaw-large-context-test.js` - 5 tests for context handling (10-100 message pairs)
- `test/simple-test.js` - Basic sanity checks
- `test/integration-test.js` - Full integration test

### Test Strategy
All tests run against remote server (192.168.0.21:3000), not localhost.
