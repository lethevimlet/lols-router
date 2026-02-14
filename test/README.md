# lols-router Test Suite

Comprehensive testing for lols-router including unit tests and integration tests.

**All tests are designed to run remotely** using `remote-helper.js` when needed. No shell scripts (.sh) - all tests are JavaScript.

## Quick Start

```bash
# Unit tests (no server required)
npm test                    # Run unit tests

# Integration tests (requires running server)
npm run test:integration    # Full API integration tests
npm run test:stt            # Speech-to-text tests
npm run test:vision         # Vision model tests
npm run test:gpu-config     # GPU configuration tests
npm run test:ws             # WebSocket log tests
npm run test:system-prompt  # System prompt priority tests
npm run test:all            # Run all tests (unit + integration + features)

# Remote tests (uses .env/remote.json configuration)
npm run test:remote         # Full remote test workflow (start → test → stop)
npm run test:remote:quick   # Quick test against running remote server
```

## Test Files

### 1. `simple-test.js` - Unit Tests

Basic sanity checks that validate the codebase structure and configuration.

**Tests:**
- Core files exist
- Configuration loads
- Models configuration loads
- Model router module loads
- Environment config override works
- Models.json structure is valid
- Package.json has dependencies

**Usage:**
```bash
# Run locally
npm test
# or
node test/simple-test.js

# Run on remote
node scripts/remote-helper.js exec "cd ~/lols-router && node test/simple-test.js"
```

### 2. `integration-test.js` - API Integration Tests

Real HTTP requests against a running server to validate API functionality.

**Tests:**
- Server reachability
- Models endpoint returns valid data
- Model availability check
- Simple chat completion
- Streaming chat completion
- Category routing (code requests)
- Invalid model name handling
- Missing required fields handling
- Health check performance

**Usage:**
```bash
# Test local server
npm run test:integration
# or
node test/integration-test.js

# Test specific server
node test/integration-test.js http://192.168.0.21:3000

# Full workflow on remote (start + test + stop)
npm run test:remote
# or
node scripts/remote-helper.js test-remote

# Test against already running remote server
npm run test:remote:quick
# or
node scripts/remote-helper.js test-integration

# Run all tests (unit + integration)
npm run test:all
```

### 3. `vision-integration-test.js` - Vision Model Tests

Tests for vision model detection and multimodal routing.

**Tests:**
- Image content detection
- Vision category routing
- Multimodal request handling
- Vision model availability
- mmproj file loading

**Usage:**
```bash
# Run locally (requires vision model configured)
npm run test:vision
# or
node test/vision-integration-test.js

# Run on remote (accepts server URL)
node test/vision-integration-test.js http://192.168.0.21:3000
```

**Requirements:**
- Vision model configured in `models.json` (e.g., `minicpm-v-2.6`)
- mmproj file downloaded to llama.cpp cache
- Server running with vision model loaded

**Test Image:**
- Tests use `test/test.jpg` (115KB cat image)
- If not present, tests will skip or use fallback

### 4. `stt-integration-test.js` - Speech-to-Text Tests

Tests for Whisper.cpp integration and audio transcription.

**Usage:**
```bash
npm run test:stt
# or
node test/stt-integration-test.js http://192.168.0.21:3000
```

### 5. `ws-logs-test.js` - WebSocket Tests

Tests WebSocket log broadcasting functionality.

**Usage:**
```bash
npm run test:ws
# or
node test/ws-logs-test.js http://192.168.0.21:3000
```

### 6. `gpu-config-test.js` - GPU Configuration Tests

Tests GPU configuration and detection.

**Usage:**
```bash
npm run test:gpu-config
# or
node test/gpu-config-test.js
```

### 7. `system-prompt-priority-test.js` - System Prompt Tests

Tests system prompt priority and injection handling.

**Usage:**
```bash
npm run test:system-prompt
# or
node test/system-prompt-priority-test.js http://192.168.0.21:3000
```

### 8. `test-remote-qwen3-8b.js` - Model-Specific Test Example

Example of a model-specific remote test with proper structure.

**Usage:**
```bash
node test/test-remote-qwen3-8b.js
```

---

## Remote Testing with remote-helper.js

All tests can accept a server URL as the first argument for remote testing:

```bash
node test/integration-test.js http://192.168.0.21:3000
node test/vision-integration-test.js http://192.168.0.21:3000
node test/stt-integration-test.js http://192.168.0.21:3000
node test/ws-logs-test.js http://192.168.0.21:3000
```

**URL resolution priority:**
1. Command line argument: `node test/integration-test.js <URL>`
2. Environment variable: `SERVER_URL=http://...`
3. Default: `http://localhost:3000`

## Test Results

### Unit Tests
✅ **7/7 tests passing** on both local and remote

### Integration Tests
✅ **12/12 tests passing** (including vision tests)

**Tests include:**
- Server reachability
- Models endpoint validation
- Chat completion (text)
- Streaming responses
- Category routing (code, chat, reason)
- Vision category routing (multimodal)
- Vision model direct selection
- Error handling (invalid model, missing fields)
- Health check performance

### Vision Tests
✅ **Vision tests passing** when vision model is configured

**Note:** Integration tests automatically adapt to available models. Vision tests require:
- Vision model in `models.json` (e.g., `minicpm-v-2.6`)
- mmproj file in llama.cpp cache
- Test image at `test/test.jpg`

## Remote Testing Workflow

### Quick Test
Test against an already running remote server:
```bash
npm run test:remote:quick
```

### Full Test Workflow
Complete workflow with automatic server management:
```bash
npm run test:remote
```

This command will:
1. Stop any existing server
2. Start fresh server instance
3. Wait for server to be ready
4. Run all integration tests
5. Stop the server
6. Report results

### Using remote-helper.js directly
For more control over the process:
```bash
# 1. Deploy latest code
node scripts/remote-helper.js deploy

# 2. Check server status
node scripts/remote-helper.js status

# 3. Run tests
node scripts/remote-helper.js test-integration  # Integration tests

# 4. View logs if issues
node scripts/remote-helper.js logs-tail 100
```

### All remote-helper.js test commands

```bash
# Server management
node scripts/remote-helper.js start      # Start server on remote
node scripts/remote-helper.js stop       # Stop server gracefully
node scripts/remote-helper.js restart    # Restart server
node scripts/remote-helper.js status     # Check server status
node scripts/remote-helper.js logs       # Stream logs (Ctrl+C to exit)

# Testing
node scripts/remote-helper.js test-remote       # Full workflow (start + test + stop)
node scripts/remote-helper.js test-integration  # Integration tests only

# Deployment
node scripts/remote-helper.js deploy     # Full deployment (sync + install + restart)
node scripts/remote-helper.js sync       # Sync code only
```

## Test Configuration

Integration tests use settings from `.env/remote.json`:

```json
{
  "testing": {
    "healthCheckEndpoint": "http://192.168.0.21:3000/v1/models"
  }
}
```

## Writing New Tests

### Adding Unit Tests
Add test cases to `simple-test.js`:

```javascript
function testYourFeature() {
  try {
    // Your test logic
    const result = yourFunction();
    if (result === expected) {
      logTest('Your feature works', true);
      return true;
    }
    logTest('Your feature works', false, 'Unexpected result');
    return false;
  } catch (error) {
    logTest('Your feature works', false, error.message);
    return false;
  }
}
```

### Adding Integration Tests
Add async test functions to `integration-test.js`:

```javascript
async function testYourEndpoint() {
  try {
    const response = await curlRequest('/your/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { your: 'data' }
    });
    
    const isValid = response.ok && /* your validation */;
    
    logTest('Your endpoint test', isValid, 'Optional details');
    return isValid;
  } catch (error) {
    logTest('Your endpoint test', false, error.message);
    return false;
  }
}
```

Then add to the test array in `runTests()`:
```javascript
{ name: 'Your Endpoint', fn: testYourEndpoint, critical: false }
```

### Writing Remote-Compatible Tests

All tests should accept a server URL parameter to enable remote testing:

```javascript
#!/usr/bin/env node
/**
 * Test description
 * Usage: node test/my-test.js [SERVER_URL]
 */

const http = require('http');
const url = require('url');

// Accept URL from argument, environment, or default
const SERVER_URL = process.argv[2] || process.env.SERVER_URL || 'http://localhost:3000';
const parsedUrl = new url.URL(SERVER_URL);

console.log('🧪 Testing feature...');
console.log(`   Server: ${SERVER_URL}\n`);

async function runTest() {
  const options = {
    hostname: parsedUrl.hostname,      // Don't hardcode!
    port: parsedUrl.port || 3000,      // Use parsed port
    path: '/v1/your/endpoint',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  // Your test logic here
}

runTest().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
```

**Key points:**
1. ✅ Accept SERVER_URL as first argument
2. ✅ Check SERVER_URL environment variable as fallback
3. ✅ Parse URL with `url.URL()` - don't hardcode host/port
4. ✅ Use `parsedUrl.hostname` and `parsedUrl.port`
5. ✅ Log the server URL being tested
6. ✅ Exit with code 1 on failure for CI integration

**Adding to remote-helper.js:**

If your test needs to be run via remote-helper.js, add a command:

```javascript
// In scripts/remote-helper.js
'test-myfeature': (config) => {
  console.log('🧪 Running my feature test on remote server...\n');
  const { healthCheckEndpoint } = config.testing;
  const serverUrl = healthCheckEndpoint.replace(/\/v1\/models$/, '');
  
  const cmd = `node test/my-feature-test.js ${serverUrl}`;
  
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('\n✅ My feature test completed!');
  } catch (err) {
    console.error('\n❌ My feature test failed');
    process.exit(1);
  }
}
```

Then add to package.json:
```json
{
  "scripts": {
    "test:remote:myfeature": "node scripts/remote-helper.js test-myfeature"
  }
}
```

And update remote-helper.js help text to include the new command.

## Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      # Unit tests (no server needed)
      - name: Run unit tests
        run: node test/simple-test.js
      
      # Integration tests (requires server)
      - name: Install dependencies
        run: npm install
      
      - name: Start server
        run: node src/server.js &
        env:
          PORT: 3000
      
      - name: Wait for server
        run: sleep 5
      
      - name: Run integration tests
        run: node test/integration-test.js http://localhost:3000
```

## Troubleshooting

### Integration Tests Fail with "Server not reachable"
- Check if server is running: `node scripts/remote-helper.js status`
- Check firewall rules: `curl http://remote-ip:3000/v1/models`
- View server logs: `node scripts/remote-helper.js logs-tail 50`

### Tests Timeout
- Increase timeout in test files (TEST_TIMEOUT constant)
- Check server performance with: `node scripts/remote-helper.js status`
- Verify model loading time in logs

### Model Not Found Errors
- Integration tests automatically adapt to available models
- Check which models are configured: `curl http://remote:3000/v1/models`
- Update models.json if needed

### SSH Password Prompts
- Use SSH key authentication instead (see docs/REMOTE_TESTING.md)
- Or ensure password is correctly set in .env/remote.json

## Test Coverage

### ✅ Current Coverage (Implemented)
- ✅ Configuration loading and validation
- ✅ Model loading and availability
- ✅ API endpoints (models, chat, cleanup)
- ✅ **Vision models** (multimodal requests)
- ✅ **Image detection** and routing
- ✅ Streaming responses (SSE)
- ✅ Error handling (invalid models, missing fields)
- ✅ Category routing (vision, code, chat, reason, tools)
- ✅ Health checks and performance
- ✅ **mmproj file loading** (vision models)
- ✅ **Kill models** endpoint

### 🔜 Future Tests (Planned)
- [ ] Tool/function calling
- [ ] System prompt injection prevention
- [ ] Concurrent request handling
- [ ] GPU orchestration (model switching)
- [ ] Router model integration
- [ ] Remote API proxying
- [ ] WebSocket status updates
- [ ] VRAM monitoring accuracy
- [ ] Multiple vision models
- [ ] Large image handling (>10MB)

## Performance Benchmarks

Expected response times:
- Models endpoint: < 100ms
- Simple chat completion: 2-10s (depending on model)
- Streaming first token: 1-5s

## Contributing

When adding new features:
1. Write unit tests first (if applicable)
2. Add integration tests for API changes
3. Ensure all tests pass locally
4. Test on remote before committing
5. Update this README if needed

## Questions?

See main project documentation:
- `docs/REMOTE_TESTING.md` - Remote testing setup
- `docs/API_REFERENCE.md` - API documentation
- `AGENTS.md` - Agent instructions
