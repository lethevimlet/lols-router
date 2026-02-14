<div align="center">

# 😂 **lols-router**

**Local OpenAI-compatible LLM Server Router**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*Intelligent routing for local LLMs with OpenAI-compatible API*

[Features](#-features) • [Quick Start](#-quick-start) • [Configuration](#️-configuration) • [API Usage](#-api-usage) • [Web Interface](#-web-interface)

---

![lols-router Web Interface](docs/gui.png)

</div>

---

## 🚀 **Features**

### **🧠 Intelligent Routing**
- **Auto-categorization**: Automatically routes requests to the best model based on task type
- **Categories**: `vision`, `reason`, `chat`, `code`, `tools`, `default`
- **128k Context Window**: Native support for extended context (131,072 tokens) with optimized q4_0 KV cache
- **Multimodal Support**: Automatic image detection and vision model routing
- **Speech-to-Text**: Whisper.cpp integration for audio transcription
- **Smart defaults**: Falls back gracefully when specific models are unavailable

### **🎮 Single-GPU Orchestration**
- Manages multiple llama.cpp and whisper.cpp models on one GPU
- Automatic model switching between LLM and STT models
- Memory-efficient process management
- Real-time VRAM monitoring
- Only one model in VRAM at any time

### **🌐 OpenAI-Compatible API**
- Drop-in replacement for OpenAI API
- **Vision Models**: Multimodal support with automatic image detection
- **Audio Transcription**: `/v1/audio/transcriptions` endpoint for speech-to-text
- Streaming support (SSE)
- Works with existing OpenAI client libraries
- Remote API proxying (OpenAI, Anthropic, etc.)

### **📊 Real-Time Monitoring**
- Beautiful web interface with live metrics
- GPU temperature and VRAM usage
- CPU and RAM monitoring
- Per-model process tracking
- Tokens/second performance display

### **⚡ Performance & Management**
- **Automatic cleanup** for orphaned processes on startup
- **Kill Models button** to free VRAM manually
- **VRAM segmentation** showing per-model memory usage
- Colored, structured logging
- Configurable via JSON
- WebSocket-based status updates

---

## 🏁 **Quick Start**

### **Prerequisites**
- Node.js ≥ 18.0.0
- NVIDIA GPU with CUDA support (for local models)
- `llama-server` binary ([llama.cpp](https://github.com/ggerganov/llama.cpp))
- `whisper-server` binary (optional, for STT - [whisper.cpp](https://github.com/ggerganov/whisper.cpp))

### **Installation**

```bash
# Clone the repository
git clone https://github.com/lethevimlet/lols-router.git
cd lols-router

# Install dependencies
npm install

# Configure model paths in config.json
# - llama.bin and llama.cache (for LLM models)
# - whisper.bin and whisper.models (for STT models)
# - whisper.gpu.enabled (default: true for GPU acceleration)

# Start the server
npm start
```

Server runs on **http://localhost:3000** 🎉

**GPU Support**: LLM, Vision, and STT models all support CUDA acceleration. GPU usage is managed by the orchestrator - only one model runs on GPU at a time. Configure in `config.json`:

```json
{
  "llama": {
    "gpu": {
      "enabled": true,
      "layers": -1,
      "device": 0
    }
  },
  "whisper": {
    "gpu": {
      "enabled": true,
      "device": 0
    }
  }
}
```

**Options**:
- `llama.gpu.enabled` - Enable/disable GPU for LLM and vision models (default: `true`)
- `llama.gpu.layers` - Number of layers to offload to GPU: `-1` = all, `0` = none (CPU-only), `1-N` = partial offload
- `llama.gpu.device` - GPU device ID for multi-GPU systems (default: `0`)
- `whisper.gpu.enabled` - Enable/disable GPU for STT models (default: `true`)
- `whisper.gpu.device` - GPU device ID for STT (default: `0`)

**CPU-only mode** (disable GPU entirely):
```json
{
  "llama": { "gpu": { "enabled": false } },
  "whisper": { "gpu": { "enabled": false } }
}
```

### **Optional: Remote API Keys**

Add remote API keys directly in `src/models.json`:

```json
{
  "models": {
    "gpt-4": {
      "type": "remote",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "apiKey": "sk-your-actual-key-here",
      "model": "gpt-4"
    }
  }
}
```

> **Note**: Keep your API keys secure. Add `src/models.json` to `.gitignore` if storing real keys.

---

## 🔧 **Configuration**

### **`src/config.json`** - Server Settings

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "logging": {
    "enabled": true,
    "debug": false,
    "colorOutput": true
  },
  "systemMetrics": {
    "enabled": true,
    "updateInterval": 2000
  },
  "router": {
    "enabled": true,
    "model": "qwen2.5-1.5b-instruct",
    "port": 3001
  },
  "llama": {
    "bin": "~/llama.cpp/build/bin/llama-server",
    "cache": "~/.cache/llama.cpp"
  }
}
```

### **`src/models.json`** - Model Configuration

```json
{
  "router": {
    "model": "qwen2.5-1.5b-instruct",
    "port": 3001
  },
  "lols-smart": {
    "default": "qwen2.5-coder-14b-instruct",
    "reason": "qwen2.5-coder-14b-instruct",
    "chat": "qwen2.5-coder-14b-instruct",
    "code": "qwen2.5-coder-14b-instruct"
  },
  "models": {
    "qwen2.5-coder-14b-instruct": {
      "type": "llama-cpp",
      "repo": "bartowski/Qwen2.5-Coder-14B-Instruct-GGUF",
      "file": "Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf",
      "context": 131072,
      "port": 8026,
      "performance": {
        "flashAttention": true,
        "batch": 8192,
        "ubatch": 2048,
        "threads": 12,
        "parallel": 1,
        "contBatching": true,
        "cacheTypeK": "q4_0",
        "cacheTypeV": "q4_0"
      }
    }
  }
}
```

### **Remote API Models**

```json
{
  "models": {
    "gpt-4": {
      "type": "remote",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "apiKey": "sk-your-actual-key-here",
      "model": "gpt-4"
    }
  }
}
```

> **Security**: Add `src/models.json` to `.gitignore` if storing real API keys. Alternatively, use `${OPENAI_API_KEY}` syntax to read from environment variables.

---

## 💬 **API Usage**

### **Intelligent Routing (lols-smart)**

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "lols-smart",
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ]
  }'
```

The router automatically detects this is a **reasoning task** and routes to the 7B model.

### **Direct Model Selection**

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-1.5b-instruct",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### **Streaming Responses**

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "lols-smart",
    "messages": [{"role": "user", "content": "Write a poem"}],
    "stream": true
  }'
```

### **Vision Model (Multimodal)**

```bash
# Encode your image to base64
IMAGE_BASE64=$(base64 -w 0 image.jpg)

curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"lols-smart\",
    \"messages\": [{
      \"role\": \"user\",
      \"content\": [
        {\"type\": \"text\", \"text\": \"What's in this image?\"},
        {\"type\": \"image_url\", \"image_url\": {\"url\": \"data:image/jpeg;base64,$IMAGE_BASE64\"}}
      ]
    }],
    \"max_tokens\": 200
  }"
```

The router automatically detects the image and routes to the **vision model** (e.g., MiniCPM-V-2.6).

### **Audio Transcription (Speech-to-Text)**

```bash
# Transcribe audio file to text
curl http://localhost:3000/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "model=whisper-small" \
  -F "response_format=json"

# Verbose JSON response with timestamps
curl http://localhost:3000/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=whisper-small" \
  -F "response_format=verbose_json" \
  -F "language=en"
```

**Supported audio formats**: mp3, wav, ogg, webm, m4a, flac (max 25 MB)

**Available models**: `whisper-small`, `whisper-base`, `whisper-medium`

### **Using with OpenAI Python Client**

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="not-needed"  # Local server doesn't require auth
)

# Text completion
response = client.chat.completions.create(
    model="lols-smart",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)

# Vision completion (with image)
import base64

with open("image.jpg", "rb") as f:
    image_data = base64.b64encode(f.read()).decode()

response = client.chat.completions.create(
    model="lols-smart",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
        ]
    }],
    max_tokens=200
)

print(response.choices[0].message.content)
```

---

## 🎨 **Web Interface**

Access the beautiful test interface at **http://localhost:3000**

### **Features:**
- ✅ Real-time system metrics (GPU, CPU, RAM)
- ✅ GPU temperature monitoring with color-coded badges
- ✅ VRAM segmentation showing per-model usage
- ✅ **Image upload** for vision model testing
- ✅ **Audio upload** for speech-to-text transcription
- ✅ **Kill Models button** to free VRAM instantly
- ✅ Live tokens/second display during streaming
- ✅ Request/response testing with configurable options
- ✅ Model and category status indicators
- ✅ Dark mode compatible

---

## 📚 **Documentation**

| Document | Description |
|----------|-------------|
| [📖 **docs/README.md**](docs/README.md) | **Complete documentation index** |
| [🧠 LOLS_SMART_ROUTING.md](docs/LOLS_SMART_ROUTING.md) | Intelligent routing system explained |
| [👁️ VISION_SUMMARY.md](docs/VISION_SUMMARY.md) | Vision model setup and usage |
| [🎙️ STT_IMPLEMENTATION.md](docs/STT_IMPLEMENTATION.md) | Speech-to-text with whisper.cpp |
| [🌐 REMOTE_API.md](docs/REMOTE_API.md) | Configure external API providers |
| [🧪 REMOTE_TESTING.md](docs/REMOTE_TESTING.md) | Remote deployment and testing |
| [📡 API_REFERENCE.md](docs/API_REFERENCE.md) | Complete API documentation |
| [💡 EXAMPLES.md](docs/EXAMPLES.md) | Request/response examples |
| [🤖 AGENTS.md](AGENTS.md) | Development and contribution guide |

---

## 🎯 **Use Cases**

- **Local AI Development**: Test and develop against local models with OpenAI-compatible API
- **Multi-Model Workflows**: Automatically route different task types to specialized models
- **Cost Optimization**: Use smaller models for simple tasks, larger for complex reasoning
- **Privacy**: Keep all inference on your local machine
- **API Gateway**: Proxy and monitor requests to remote APIs
- **Performance Testing**: Real-time metrics for model performance comparison

---

## 🛠️ **Development**

### **Project Structure**
```
lols-router/
├── src/
│   ├── config.json          # Server configuration
│   ├── models.json          # Model definitions
│   ├── server.js            # Express server
│   ├── endpoint/            # API endpoints
│   ├── helpers/             # Core logic
│   │   ├── orchestrator.js  # Model management
│   │   ├── model-router.js  # Smart routing
│   │   ├── system-metrics.js# Monitoring
│   │   └── logger.js        # Colored logging
│   └── webapp/              # Web interface
│       ├── index.html
│       ├── style.css
│       └── script.js
└── docs/                    # Documentation
```

### **Configuration Priority**

Settings are loaded in this order (highest priority first):

1. **`src/config.json`** - Main configuration file
   - Server settings (port, host)
   - Logging options
   - llama.cpp paths (`llama.bin`, `llama.cache`)
   - System metrics, router, GPU, webapp settings

2. **`src/models.json`** - Model definitions and API keys
   - Local llama.cpp models
   - Remote API endpoints with keys (OpenAI, Anthropic, etc.)

3. **Environment Variables** (optional fallback)
   - `LLAMA_BIN` - Overrides `config.llama.bin` if set
   - `LLAMA_CACHE` - Overrides `config.llama.cache` if set

> **Recommended**: Configure everything in `config.json` and `models.json` for consistency.

---

## 🤝 **Contributing**

Contributions are welcome! See [AGENTS.md](AGENTS.md) for development guidelines.

### **Quick Contribution Guide**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⚠️ **Security**

- **Protect API keys**: Add `src/models.json` to `.gitignore` if storing real keys, or use `${ENV_VAR}` syntax
- **Keep config private**: Don't commit `src/config.json` with sensitive paths
- **Local only by default**: Server binds to `0.0.0.0` - configure firewall appropriately
- **No authentication**: This is a local development tool - add auth if exposing publicly

---

## 🙏 **Acknowledgments**

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Fast LLM inference
- [bartowski](https://huggingface.co/bartowski) - Quantized GGUF models
- [Qwen Team](https://github.com/QwenLM/Qwen) - Excellent base models
- OpenAI - Compatible API specification

---

<div align="center">

**Made with ❤️ for the local LLM community**

[⭐ Star on GitHub](https://github.com/lethevimlet/lols-router) • [🐛 Report Bug](https://github.com/lethevimlet/lols-router/issues) • [💡 Request Feature](https://github.com/lethevimlet/lols-router/issues)

</div>
