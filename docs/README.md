# lols-router Documentation

## Quick Start

See [../INIT.md](../INIT.md) for project setup and deployment workflows.

## Feature Documentation

- **[VISION.md](VISION.md)** - Vision model integration (MiniCPM-V-2.6)
- **[STT_IMPLEMENTATION.md](STT_IMPLEMENTATION.md)** - Speech-to-text with Whisper.cpp
- **[IMAGE_HANDLING.md](IMAGE_HANDLING.md)** - Multimodal image handling
- **[PERFORMANCE_TUNING.md](PERFORMANCE_TUNING.md)** - GPU optimization and context scaling
- **[PERFORMANCE.md](PERFORMANCE.md)** - Performance notes and benchmarks

## Architecture

### Model Routing

The router uses a small 0.5B model to classify requests into categories:
- `default` - General assistant tasks
- `reason` - Deep thinking/reasoning
- `chat` - Conversational
- `code` - Programming tasks
- `vision` - Image understanding

Categories are defined in `.env/models.json` under the `lols-smart` section.

### System Prompt Priority

1. User-provided (if `config.systemPrompt.ignoreRoleSystem = false`)
2. Category-level (from `lols-smart.<category>.systemPromptPath`)
3. Model-level (from `models.<model>.systemPrompt`)

### Deployment

This project deploys to a remote server (192.168.0.21). See `../INIT.md` for npm scripts:
- `npm run deploy` - Deploy code
- `npm run pm2:restart` - Restart service
- `npm run pm2:logs` - View logs

### Testing

Tests are in `../test/`:
- `openclaw-compat-test.js` - OpenClaw compatibility
- `openclaw-large-context-test.js` - Large context handling
- Other integration tests for vision, STT, etc.

Run with: `node test/<test-name>.js`
