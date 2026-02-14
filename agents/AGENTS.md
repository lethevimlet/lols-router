# AGENTS.md - lols-router Project Guide

Read this when starting work on lols-router project.

## First Run

1. Read `INIT.md` in root for human-facing overview
2. Read this file for AI agent instructions
3. Read `PROJECT.md` for technical architecture

## Critical Rules

### Git & Deployment

**NEVER commit or push until explicitly told "commit push" or "commit and push"**
- Always stage changes and show what will be committed first
- Wait for explicit approval

**NEVER deploy locally**
- This project runs on remote: **192.168.0.21** (user: `ai`, password in `.env/remote.json`)
- Use npm scripts: `npm run deploy`, `npm run pm2:restart`, etc.
- Testing is against remote server, not localhost

### File Organization

**DO NOT write .md files to root** (except README.md and INIT.md which already exist)
- Agent notes → `agents/`
- Documentation → `docs/`
- Tests → `test/`
- Scripts → `scripts/`

**DO NOT write test files to root**
- All tests go in `test/` directory

**DO NOT create temporary debug scripts in root**
- Use `scripts/` for helper scripts
- Delete after debugging or move to `scripts/`

## Deployment Workflow

```bash
# 1. Make changes to code
vim src/server.js

# 2. Deploy to remote (uses rsync)
npm run deploy

# 3. Restart the service
npm run pm2:restart

# 4. Check logs
npm run pm2:logs

# 5. Test
node test/openclaw-compat-test.js
```

**Available npm scripts:**
- `npm run deploy` - Deploy code to 192.168.0.21
- `npm run pm2:restart` - Restart PM2 service
- `npm run pm2:status` - Check status
- `npm run pm2:logs` - View logs (last 100 lines)
- `npm run test:remote` - Run remote integration tests

## Configuration

### Deployment vs Local

**Remote server uses `.env/` folder:**
- `.env/models.json` - Model definitions (THIS is what the server reads)
- `.env/config.json` - Server config (THIS is what the server reads)
- `.env/remote.json` - SSH credentials

**Root files are templates/reference:**
- `models.json` - Reference only
- `config.json` - Reference only

**When making config changes:**
1. Edit `.env/models.json` or `.env/config.json`
2. Run `npm run deploy` to sync
3. Run `npm run pm2:restart` to reload

### Model Categories (lols-smart)

Defined in `.env/models.json`:
- `default` - General assistant
- `reason` - Deep thinking
- `chat` - Conversational
- `code` - Programming
- `vision` - Image understanding

**DO NOT add `tools` category** - Tools in requests are ignored, routing is based on message content only.

## Testing

**Always test against remote server:**
```bash
# Full compatibility test
node test/openclaw-compat-test.js

# Large context test
node test/openclaw-large-context-test.js

# Or specify server URL
SERVER_URL=http://192.168.0.21:3000 node test/simple-test.js
```

## Common Tasks

### Add a new model

1. Edit `.env/models.json`:
```json
"models": {
  "new-model-name": {
    "type": "llama-cpp",
    "repo": "huggingface/repo",
    "file": "model.gguf",
    "port": 8028,
    "context": 32768,
    "timeout": 300,
    "maxTokens": 16384
  }
}
```

2. Update category if needed:
```json
"lols-smart": {
  "code": {
    "model": "new-model-name",
    "systemPromptPath": "prompts/coding-expert.md"
  }
}
```

3. Deploy: `npm run deploy && npm run pm2:restart`

### Debug issues

```bash
# Check if service is running
npm run pm2:status

# View logs
npm run pm2:logs

# Check which models are loaded
curl http://192.168.0.21:3000/v1/models

# Test simple request
curl -X POST http://192.168.0.21:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"lols-smart","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'
```

### Update system prompts

Prompts are in `prompts/` directory:
- `general-assistant.md`
- `coding-expert.md`
- `deep-thinker.md`
- `chat-assistant.md`
- `router-classifier.md`

Edit, then: `npm run deploy && npm run pm2:restart`

## Important Notes

### Authentication
- lols-router has permissive auth middleware
- Accepts any Authorization header without validation
- Works with or without API keys
- Compatible with OpenClaw's `api-key` auth mode

### OpenClaw Integration
- OpenClaw config: `~/.openclaw/openclaw.json`
- Provider: `lols-router` → `http://192.168.0.21:3000/v1`
- Auth: `api-key` (but any value works)
- Context window: 131072 (131k tokens)
- Tools: Ignored by router, routes on message content

### Remote Server Details
- **Host:** 192.168.0.21
- **User:** ai
- **Service:** PM2 process `lols-router`
- **Main port:** 3000 (API)
- **Router port:** 3001 (internal router model)
- **Node version:** v24.13.0 (via nvm)

## Troubleshooting

### "fetch failed" errors
1. Check PM2: `npm run pm2:status`
2. Restart: `npm run pm2:restart`
3. Check logs: `npm run pm2:logs`

### Router model not responding (port 3001)
- Should see "Routing model ready on port 3001" in startup logs
- Model: qwen2.5-0.5b-instruct
- If stuck, kill llama-server processes and restart

### Config files not found
- Server expects `src/models.json` and `src/config.json`
- Copy from `.env/`: `ssh ai@192.168.0.21 'cd ~/lols-router && cp .env/models.json src/'`

### Manual SSH access (if npm scripts fail)
```bash
ssh ai@192.168.0.21
# Password in .env/remote.json
cd ~/lols-router
source ~/.nvm/nvm.sh  # Load node/npm/pm2
pm2 restart lols-router
pm2 logs lols-router
```

## Memory

Use this file to track important decisions, patterns, and lessons learned specific to this project. Update as you work.

### Recent Changes
- 2026-02-13: Added permissive auth middleware for OpenClaw compatibility
- 2026-02-13: Removed "tools" category routing (ignores tool definitions)
- 2026-02-13: Created comprehensive test suite for OpenClaw integration
