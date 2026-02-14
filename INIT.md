# INIT.md - lols-router Project Entry Point

**If you're an AI agent starting work on this project:**

1. **Read `agents/AGENTS.md`** - Your main instructions, rules, and workflows
2. **Read `agents/PROJECT.md`** - Technical architecture and implementation details
3. Come back here for the human-facing quick reference

---

## Quick Reference

### Critical Rules

### 1. **NEVER commit or push until explicitly told to do so**
- Wait for explicit "commit and push" or "commit push" instruction
- Always stage and show changes first, then ask for approval

### 2. **NEVER deploy locally**
- This project runs on **remote server: 192.168.0.21** (user: `ai`)
- All deployment is via `npm run deploy` or direct remote-helper.js scripts
- Testing against remote server, not localhost

### 3. **Use npm scripts, not manual SSH**
```bash
npm run deploy              # Deploy code to remote
npm run pm2:restart         # Restart service
npm run pm2:logs            # View logs
npm run pm2:status          # Check status
npm run test:remote         # Run integration tests
```

### 4. **File Organization**
```
root/
├── .env/              # Deployment configs (models.json, config.json, remote.json)
├── test/              # Test files (.js only)
├── scripts/           # Helper scripts (remote-helper.js, keep-warm.js)
├── docs/              # Documentation (if needed)
├── agents/            # Agent-specific files (NOT for markdown docs)
└── src/               # Source code (server, endpoints, helpers)
```

**DO NOT write .md files to root:**
- ❌ NO `.md` files in root (except README.md and INIT.md which already exist)
- ❌ NO test files in root
- ❌ NO temporary debug/fix scripts in root

**DO:**
- ✅ Tests go in `test/`
- ✅ Scripts go in `scripts/`
- ✅ Docs go in `docs/`

## Project Structure

### Configuration Files

**`.env/` folder** (deployment-specific, not in git):
- `models.json` - Model definitions and routing categories
- `config.json` - Server settings (ports, logging, GPU)
- `remote.json` - SSH credentials and deployment config

**Root config files** (in git, reference/local):
- `models.json` - Reference configuration
- `config.json` - Reference configuration

**Which to edit:**
- Remote server uses `.env/*` files
- Edit `.env/models.json` for deployed changes
- Root files are templates/reference

### Key Files

- `src/server.js` - Main Express server
- `src/helpers/model-router.js` - Routing logic (categories: default, reason, chat, code, vision)
- `src/helpers/orchestrator.js` - GPU management and model loading
- `src/endpoint/chat.js` - Main chat completions endpoint
- `scripts/remote-helper.js` - Deployment automation

## Deployment Workflow

```bash
# 1. Make code changes
vim src/server.js

# 2. Deploy to remote
npm run deploy

# 3. Restart service
npm run pm2:restart

# 4. Check logs
npm run pm2:logs

# 5. Test
npm run test:remote
# OR
node test/openclaw-compat-test.js
```

## Testing

**Test files location:** `test/`

**Available tests:**
- `test/openclaw-compat-test.js` - OpenClaw integration tests
- `test/openclaw-large-context-test.js` - Large context handling
- `test/simple-test.js` - Basic functionality

**Run tests:**
```bash
# Against remote server
SERVER_URL=http://192.168.0.21:3000 node test/openclaw-compat-test.js

# Or use npm script
npm run test:remote
```

## Model Categories

**Defined in `.env/models.json` under `lols-smart`:**
- `default` - General assistant
- `reason` - Deep thinking/reasoning
- `chat` - Conversational
- `code` - Coding tasks
- `vision` - Image understanding

**DO NOT add `tools` category** - router ignores tool definitions and routes based on message content.

## Important Notes

### Authentication
- lols-router accepts any Authorization header (permissive middleware)
- No actual API key validation
- Compatible with OpenClaw's `api-key` auth mode

### OpenClaw Integration
- OpenClaw config: `~/.openclaw/openclaw.json`
- Provider: `lols-router` pointing to `http://192.168.0.21:3000/v1`
- Context window: 131k (model native capacity)

### Remote Server
- **Host:** 192.168.0.21
- **User:** ai
- **Password:** (see `.env/remote.json`)
- **Service:** PM2 process named `lols-router`
- **Port:** 3000 (HTTP), 3001 (router model)

## Common Issues

### "fetch failed" errors
- Check if PM2 is running: `npm run pm2:status`
- Restart: `npm run pm2:restart`
- Check logs: `npm run pm2:logs`

### Config file not found
- Server expects `src/models.json` and `src/config.json`
- Copy from `.env/` if missing: `cp .env/models.json src/`

### Router model not responding
- Port 3001 should have qwen2.5-0.5b-instruct
- Check startup logs for "Routing model ready on port 3001"

## Quick Reference

**Deploy changes:**
```bash
npm run deploy && npm run pm2:restart
```

**View logs:**
```bash
npm run pm2:logs
```

**Run full test suite:**
```bash
node test/openclaw-compat-test.js
node test/openclaw-large-context-test.js
```

**Manual operations (if npm scripts fail):**
```bash
ssh ai@192.168.0.21
cd ~/lols-router
source ~/.nvm/nvm.sh
pm2 restart lols-router
pm2 logs lols-router
```

---

**Remember:** Always wait for explicit approval before committing or pushing to git.
