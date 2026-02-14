#!/usr/bin/env node

/**
 * Integration tests for lols-router
 * 
 * Tests the server by making actual HTTP requests
 * Can run against local or remote server
 * 
 * Usage:
 *   node test/integration-test.js                    # Test local server (localhost:3000)
 *   node test/integration-test.js http://remote:3000 # Test remote server
 */

const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const execAsync = promisify(exec);

// Test configuration
const DEFAULT_HOST = 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30 seconds per test
const SERVER_STARTUP_WAIT = 3000; // 3 seconds to wait for server startup

// Test state
let testsPassed = 0;
let testsFailed = 0;
let serverUrl = process.argv[2] || DEFAULT_HOST;
let testModel = 'lols-smart'; // Default model, can be changed if not available

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Load test image and convert to base64 data URL
 * Tries test.png first, falls back to test.jpg
 */
function loadTestImage() {
  const testDir = path.join(__dirname);
  const possibleImages = [
    { path: path.join(testDir, 'test.png'), mime: 'image/png' },
    { path: path.join(testDir, 'test.jpg'), mime: 'image/jpeg' }
  ];
  
  for (const img of possibleImages) {
    if (fs.existsSync(img.path)) {
      const imageBuffer = fs.readFileSync(img.path);
      const base64 = imageBuffer.toString('base64');
      log(`📸 Using test image: ${path.basename(img.path)}`, 'blue');
      return `data:${img.mime};base64,${base64}`;
    }
  }
  
  // Fallback to 1x1 red pixel if no test image found
  log('⚠️  No test image found, using 1x1 pixel fallback', 'yellow');
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
}

function logTest(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${icon} ${passed ? 'PASS' : 'FAIL'}: ${name}`, color);
  if (details) {
    log(`   ${details}`, 'gray');
  }
  if (passed) {
    testsPassed++;
  } else {
    testsFailed++;
  }
}

// HTTP request helper using curl
async function curlRequest(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    timeout = TEST_TIMEOUT
  } = options;

  const url = `${serverUrl}${endpoint}`;
  let curlCmd = `curl -s -w "\\n%{http_code}" --max-time ${timeout / 1000}`;
  
  // Add method
  if (method !== 'GET') {
    curlCmd += ` -X ${method}`;
  }
  
  // Add headers
  for (const [key, value] of Object.entries(headers)) {
    curlCmd += ` -H "${key}: ${value}"`;
  }
  
  // Add body - use temp file for large payloads to avoid E2BIG error
  let tempFile = null;
  if (body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    
    // Use temp file if body is large (>50KB to be safe)
    if (bodyStr.length > 50000) {
      const os = require('os');
      tempFile = path.join(os.tmpdir(), `curl-body-${Date.now()}.json`);
      fs.writeFileSync(tempFile, bodyStr);
      curlCmd += ` --data-binary @${tempFile}`;
    } else {
      curlCmd += ` -d '${bodyStr}'`;
    }
  }
  
  curlCmd += ` "${url}"`;
  
  try {
    const { stdout, stderr } = await execAsync(curlCmd);
    
    // Split response and status code
    const lines = stdout.trim().split('\n');
    const statusCode = parseInt(lines[lines.length - 1]);
    const responseBody = lines.slice(0, -1).join('\n');
    
    let data;
    try {
      data = responseBody ? JSON.parse(responseBody) : null;
    } catch (e) {
      data = responseBody;
    }
    
    return {
      ok: statusCode >= 200 && statusCode < 300,
      status: statusCode,
      data,
      raw: responseBody
    };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  } finally {
    // Clean up temp file
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// Test: Server is reachable
async function testServerReachable() {
  try {
    const response = await curlRequest('/v1/models');
    logTest('Server is reachable', response.ok, `Status: ${response.status}`);
    return response.ok;
  } catch (error) {
    logTest('Server is reachable', false, error.message);
    return false;
  }
}

// Test: Models endpoint returns valid data
async function testModelsEndpoint() {
  try {
    const response = await curlRequest('/v1/models');
    const isValid = response.ok && 
                   response.data &&
                   response.data.object === 'list' &&
                   Array.isArray(response.data.data);
    
    const modelCount = isValid ? response.data.data.length : 0;
    logTest(
      'Models endpoint returns valid data',
      isValid,
      isValid ? `Found ${modelCount} models` : 'Invalid response structure'
    );
    return isValid;
  } catch (error) {
    logTest('Models endpoint returns valid data', false, error.message);
    return false;
  }
}

// Test: Check model availability and set testModel
async function testLolsSmartAvailable() {
  try {
    const response = await curlRequest('/v1/models');
    const hasLolsSmart = response.ok &&
                        response.data &&
                        response.data.data.some(m => m.id === 'lols-smart');
    
    if (!hasLolsSmart && response.ok && response.data.data.length > 0) {
      // Use first available model instead
      testModel = response.data.data[0].id;
      const models = response.data.data.map(m => m.id).join(', ');
      logTest(
        'lols-smart model is available', 
        false, 
        `Using ${testModel} instead. Available: ${models}`
      );
    } else {
      logTest('lols-smart model is available', hasLolsSmart);
    }
    return hasLolsSmart;
  } catch (error) {
    logTest('lols-smart model is available', false, error.message);
    return false;
  }
}

// Test: Chat completion with simple request
async function testSimpleChatCompletion() {
  try {
    const requestBody = {
      model: testModel,
      messages: [
        { role: 'user', content: 'Say "test successful" if you can read this.' }
      ],
      max_tokens: 50,
      stream: false
    };
    
    const response = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      timeout: 60000 // 60 seconds for model inference
    });
    
    const isValid = response.ok &&
                   response.data &&
                   response.data.object === 'chat.completion' &&
                   response.data.choices &&
                   response.data.choices.length > 0 &&
                   response.data.choices[0].message;
    
    const content = isValid ? response.data.choices[0].message.content : '';
    logTest(
      'Chat completion with simple request',
      isValid,
      isValid ? `Response: ${content.substring(0, 50)}...` : 'Invalid response'
    );
    return isValid;
  } catch (error) {
    logTest('Chat completion with simple request', false, error.message);
    return false;
  }
}

// Test: Streaming chat completion
async function testStreamingChatCompletion() {
  try {
    const requestBody = {
      model: testModel,
      messages: [
        { role: 'user', content: 'Count to 3.' }
      ],
      max_tokens: 30,
      stream: true
    };
    
    const response = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      timeout: 60000
    });
    
    // Streaming returns SSE format: data: {...}\n\ndata: [DONE]
    const hasStreamData = response.raw && response.raw.includes('data: ');
    const hasDone = response.raw && response.raw.includes('[DONE]');
    const isValid = hasStreamData && hasDone;
    
    logTest(
      'Streaming chat completion',
      isValid,
      isValid ? 'Stream completed with [DONE]' : 'Invalid stream format'
    );
    return isValid;
  } catch (error) {
    logTest('Streaming chat completion', false, error.message);
    return false;
  }
}

// Test: Category routing (code request)
async function testCategoryRoutingCode() {
  try {
    const requestBody = {
      model: testModel,
      messages: [
        { role: 'user', content: 'Write a Python function to calculate fibonacci numbers.' }
      ],
      max_tokens: 100,
      stream: false
    };
    
    const response = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      timeout: 60000
    });
    
    const isValid = response.ok &&
                   response.data &&
                   response.data.choices &&
                   response.data.choices.length > 0;
    
    // Check if response contains code-like content
    const content = isValid ? response.data.choices[0].message.content.toLowerCase() : '';
    const hasCodeIndicators = content.includes('def') || 
                             content.includes('function') || 
                             content.includes('fibonacci');
    
    logTest(
      'Category routing (code request)',
      isValid && hasCodeIndicators,
      isValid ? 'Response contains code' : 'Invalid response'
    );
    return isValid;
  } catch (error) {
    logTest('Category routing (code request)', false, error.message);
    return false;
  }
}

// Test: Invalid model name handling
async function testInvalidModelName() {
  try {
    const requestBody = {
      model: 'nonexistent-model',
      messages: [
        { role: 'user', content: 'test' }
      ],
      max_tokens: 10,
      stream: false
    };
    
    const response = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    });
    
    // Should return error status
    const isValid = !response.ok && response.status >= 400;
    
    logTest(
      'Invalid model name handling',
      isValid,
      `Status: ${response.status} (expected 4xx)`
    );
    return isValid;
  } catch (error) {
    logTest('Invalid model name handling', false, error.message);
    return false;
  }
}

// Test: Missing required fields
async function testMissingRequiredFields() {
  try {
    const requestBody = {
      model: testModel
      // Missing 'messages' field
    };
    
    const response = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    });
    
    // Should return error status
    const isValid = !response.ok && response.status >= 400;
    
    logTest(
      'Missing required fields handling',
      isValid,
      `Status: ${response.status} (expected 4xx)`
    );
    return isValid;
  } catch (error) {
    logTest('Missing required fields handling', false, error.message);
    return false;
  }
}

// Test: Health check via models endpoint
async function testHealthCheck() {
  try {
    const start = Date.now();
    const response = await curlRequest('/v1/models');
    const duration = Date.now() - start;
    
    const isValid = response.ok && duration < 5000; // Should respond in under 5s
    
    logTest(
      'Health check (models endpoint)',
      isValid,
      `Response time: ${duration}ms`
    );
    return isValid;
  } catch (error) {
    logTest('Health check (models endpoint)', false, error.message);
    return false;
  }
}

// Test: Vision model availability
async function testVisionModelAvailable() {
  try {
    const response = await curlRequest('/v1/models');
    const hasVisionModel = response.ok &&
                          response.data &&
                          response.data.data.some(m => 
                            m.id === 'minicpm-v-2.6' || 
                            m.id.toLowerCase().includes('vision') ||
                            m.id.toLowerCase().includes('llava')
                          );
    
    logTest(
      'Vision model is available',
      hasVisionModel,
      hasVisionModel ? 'Found vision model in models list' : 'No vision model found'
    );
    return hasVisionModel;
  } catch (error) {
    logTest('Vision model is available', false, error.message);
    return false;
  }
}

// Test: Vision category routing (multimodal content)
async function testVisionCategoryRouting() {
  try {
    // Load test image from file
    const testImageBase64 = loadTestImage();
    
    const requestBody = {
      model: 'lols-smart',
      messages: [
        { 
          role: 'user', 
          content: [
            { type: 'text', text: 'What do you see in this image?' },
            { type: 'image_url', image_url: { url: testImageBase64 } }
          ]
        }
      ],
      max_tokens: 50,
      stream: false
    };
    
    const response = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      timeout: 90000 // 90 seconds for vision model inference (slower than text)
    });
    
    const isValid = response.ok &&
                   response.data &&
                   response.data.choices &&
                   response.data.choices.length > 0;
    
    logTest(
      'Vision category routing (multimodal content)',
      isValid,
      isValid ? 'Multimodal request processed successfully' : 'Failed to process image'
    );
    return isValid;
  } catch (error) {
    logTest('Vision category routing (multimodal content)', false, error.message);
    return false;
  }
}

// Test: Vision model direct selection
async function testVisionModelDirect() {
  try {
    // Load test image from file
    const testImageBase64 = loadTestImage();
    
    const requestBody = {
      model: 'minicpm-v-2.6',
      messages: [
        { 
          role: 'user', 
          content: [
            { type: 'text', text: 'Describe this image.' },
            { type: 'image_url', image_url: { url: testImageBase64 } }
          ]
        }
      ],
      max_tokens: 100,
      stream: false
    };
    
    const response = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      timeout: 120000 // 120 seconds for vision model
    });
    
    const isValid = response.ok &&
                   response.data &&
                   response.data.choices &&
                   response.data.choices.length > 0;
    
    const content = isValid ? response.data.choices[0].message.content : '';
    logTest(
      'Vision model direct selection',
      isValid,
      isValid ? `Response: ${content.substring(0, 50)}...` : 'Failed to process with vision model'
    );
    return isValid;
  } catch (error) {
    logTest('Vision model direct selection', false, error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n🧪 Running integration tests for lols-router...\n', 'blue');
  log(`Target: ${serverUrl}\n`, 'gray');
  
  const tests = [
    { name: 'Server Reachable', fn: testServerReachable, critical: true },
    { name: 'Models Endpoint', fn: testModelsEndpoint, critical: true },
    { name: 'lols-smart Available', fn: testLolsSmartAvailable, critical: false },
    { name: 'Simple Chat Completion', fn: testSimpleChatCompletion, critical: false },
    { name: 'Streaming Chat', fn: testStreamingChatCompletion, critical: false },
    { name: 'Code Category Routing', fn: testCategoryRoutingCode, critical: false },
    { name: 'Invalid Model Handling', fn: testInvalidModelName, critical: false },
    { name: 'Missing Fields Handling', fn: testMissingRequiredFields, critical: false },
    { name: 'Health Check', fn: testHealthCheck, critical: false },
    { name: 'Vision Model Available', fn: testVisionModelAvailable, critical: false },
    { name: 'Vision Category Routing', fn: testVisionCategoryRouting, critical: false },
    { name: 'Vision Model Direct', fn: testVisionModelDirect, critical: false }
  ];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      
      // If critical test fails, stop execution
      if (test.critical && !result) {
        log(`\n⚠️  Critical test failed: ${test.name}`, 'yellow');
        log('Skipping remaining tests.\n', 'yellow');
        break;
      }
    } catch (error) {
      logTest(test.name, false, `Unexpected error: ${error.message}`);
      if (test.critical) {
        break;
      }
    }
  }
  
  // Summary
  log('\n' + '='.repeat(50), 'gray');
  log(`✅ Passed: ${testsPassed}`, 'green');
  log(`❌ Failed: ${testsFailed}`, 'red');
  log('='.repeat(50), 'gray');
  
  if (testsFailed === 0) {
    log('\n✅ All tests passed!\n', 'green');
    process.exit(0);
  } else {
    log(`\n❌ ${testsFailed} test(s) failed.\n`, 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test runner failed: ${error.message}\n`, 'red');
  process.exit(1);
});
