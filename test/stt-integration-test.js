#!/usr/bin/env node

/**
 * STT Integration tests for lols-router
 * 
 * Tests whisper.cpp integration and model switching
 * 
 * Usage:
 *   node test/stt-integration-test.js                    # Test local server (localhost:3000)
 *   node test/stt-integration-test.js http://remote:3000 # Test remote server
 */

const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const execAsync = promisify(exec);

// Test configuration
const DEFAULT_HOST = 'http://localhost:3000';
const TEST_TIMEOUT = 60000; // 60 seconds per test (transcription can be slow)
const TEST_AUDIO_FILE = path.join(__dirname, 'test-audio.wav');

// Test state
let testsPassed = 0;
let testsFailed = 0;
let serverUrl = process.argv[2] || DEFAULT_HOST;

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

/**
 * Execute curl request with FormData for file uploads
 */
async function curlTranscription(audioFile, options = {}) {
  const {
    model = 'whisper-small',
    language = '',
    responseFormat = 'verbose_json',
    timeout = TEST_TIMEOUT
  } = options;

  const url = `${serverUrl}/v1/audio/transcriptions`;
  
  let curlCmd = `curl -s -w "\\n%{http_code}" --max-time ${timeout / 1000}`;
  curlCmd += ` -F "file=@${audioFile}"`;
  curlCmd += ` -F "model=${model}"`;
  if (language) {
    curlCmd += ` -F "language=${language}"`;
  }
  if (responseFormat) {
    curlCmd += ` -F "response_format=${responseFormat}"`;
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
  }
}

/**
 * Make HTTP request using curl
 */
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
  
  // Add body
  if (body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    curlCmd += ` -d '${bodyStr}'`;
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
  }
}

// Test: Server is reachable
async function testServerReachable() {
  try {
    const response = await curlRequest('/v1/models', { timeout: 5000 });
    logTest('Server is reachable', response.ok, `Status: ${response.status}`);
    return response.ok;
  } catch (error) {
    logTest('Server is reachable', false, error.message);
    return false;
  }
}

// Test: Audio file exists
async function testAudioFileExists() {
  const exists = fs.existsSync(TEST_AUDIO_FILE);
  logTest('Test audio file exists', exists, exists ? TEST_AUDIO_FILE : 'File not found: test-audio.wav');
  return exists;
}

// Test: Whisper model available
async function testWhisperModelAvailable() {
  try {
    const response = await curlRequest('/v1/models');
    if (!response.ok) {
      logTest('Whisper model available', false, 'Failed to fetch models');
      return false;
    }
    
    const models = response.data.data || [];
    const hasWhisper = models.some(m => m.id.startsWith('whisper-'));
    
    logTest('Whisper model available', hasWhisper, 
      hasWhisper ? 'Found whisper models' : 'No whisper models found');
    return hasWhisper;
  } catch (error) {
    logTest('Whisper model available', false, error.message);
    return false;
  }
}

// Test: Basic transcription
async function testBasicTranscription() {
  if (!fs.existsSync(TEST_AUDIO_FILE)) {
    logTest('Basic transcription', false, 'Test audio file not found, skipping');
    return false;
  }

  try {
    const response = await curlTranscription(TEST_AUDIO_FILE, {
      model: 'whisper-small',
      responseFormat: 'json'
    });
    
    if (!response.ok) {
      logTest('Basic transcription', false, `Status: ${response.status}, ${JSON.stringify(response.data)}`);
      return false;
    }
    
    const hasText = response.data && response.data.text;
    logTest('Basic transcription', hasText, 
      hasText ? `Transcribed: "${response.data.text.substring(0, 50)}..."` : 'No text in response');
    return hasText;
  } catch (error) {
    logTest('Basic transcription', false, error.message);
    return false;
  }
}

// Test: Verbose transcription
async function testVerboseTranscription() {
  if (!fs.existsSync(TEST_AUDIO_FILE)) {
    logTest('Verbose transcription', false, 'Test audio file not found, skipping');
    return false;
  }

  try {
    const response = await curlTranscription(TEST_AUDIO_FILE, {
      model: 'whisper-small',
      responseFormat: 'verbose_json'
    });
    
    if (!response.ok) {
      logTest('Verbose transcription', false, `Status: ${response.status}`);
      return false;
    }
    
    const hasVerboseData = response.data && response.data.text && 
                          (response.data.language || response.data.duration !== undefined);
    logTest('Verbose transcription', hasVerboseData, 
      hasVerboseData ? `Language: ${response.data.language}, Duration: ${response.data.duration}s` : 'Missing verbose data');
    return hasVerboseData;
  } catch (error) {
    logTest('Verbose transcription', false, error.message);
    return false;
  }
}

// Test: Model switching (LLM -> STT)
async function testModelSwitchingLLMtoSTT() {
  if (!fs.existsSync(TEST_AUDIO_FILE)) {
    logTest('Model switching (LLM → STT)', false, 'Test audio file not found, skipping');
    return false;
  }

  try {
    // First, make a chat request to load an LLM model
    log('  Loading LLM model first...', 'gray');
    const chatResponse = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: 'qwen2.5-1.5b-instruct',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      }
    });
    
    if (!chatResponse.ok) {
      logTest('Model switching (LLM → STT)', false, 'Failed to load LLM model');
      return false;
    }
    
    log('  LLM model loaded, now testing STT...', 'gray');
    
    // Now make a transcription request
    const sttResponse = await curlTranscription(TEST_AUDIO_FILE, {
      model: 'whisper-small'
    });
    
    const success = sttResponse.ok && sttResponse.data && sttResponse.data.text;
    logTest('Model switching (LLM → STT)', success, 
      success ? 'Successfully switched from LLM to STT' : 'Failed to switch');
    return success;
  } catch (error) {
    logTest('Model switching (LLM → STT)', false, error.message);
    return false;
  }
}

// Test: Model switching (STT -> LLM)
async function testModelSwitchingSTTtoLLM() {
  if (!fs.existsSync(TEST_AUDIO_FILE)) {
    logTest('Model switching (STT → LLM)', false, 'Test audio file not found, skipping');
    return false;
  }

  try {
    // First, make a transcription request to load whisper
    log('  Loading STT model first...', 'gray');
    const sttResponse = await curlTranscription(TEST_AUDIO_FILE, {
      model: 'whisper-small'
    });
    
    if (!sttResponse.ok) {
      logTest('Model switching (STT → LLM)', false, 'Failed to load STT model');
      return false;
    }
    
    log('  STT model loaded, now testing LLM...', 'gray');
    
    // Now make a chat request
    const chatResponse = await curlRequest('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: 'qwen2.5-1.5b-instruct',
        messages: [{ role: 'user', content: 'Say hi' }],
        max_tokens: 10
      }
    });
    
    const success = chatResponse.ok && chatResponse.data && chatResponse.data.choices;
    logTest('Model switching (STT → LLM)', success, 
      success ? 'Successfully switched from STT to LLM' : 'Failed to switch');
    return success;
  } catch (error) {
    logTest('Model switching (STT → LLM)', false, error.message);
    return false;
  }
}

// Test: Invalid file type
async function testInvalidFileType() {
  // Create a fake text file
  const fakeFile = path.join(__dirname, 'fake-audio.txt');
  fs.writeFileSync(fakeFile, 'This is not audio');
  
  try {
    const response = await curlTranscription(fakeFile, {
      model: 'whisper-small'
    });
    
    // Should fail with 400
    const success = !response.ok && response.status === 400;
    logTest('Invalid file type rejection', success, 
      success ? 'Correctly rejected non-audio file' : `Unexpected status: ${response.status}`);
    
    // Cleanup
    fs.unlinkSync(fakeFile);
    return success;
  } catch (error) {
    // Cleanup
    if (fs.existsSync(fakeFile)) {
      fs.unlinkSync(fakeFile);
    }
    logTest('Invalid file type rejection', false, error.message);
    return false;
  }
}

// Test: Missing file
async function testMissingFile() {
  try {
    const response = await curlRequest('/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { model: 'whisper-small' }
    });
    
    // Should fail with 400
    const success = !response.ok && response.status === 400;
    logTest('Missing file rejection', success, 
      success ? 'Correctly rejected request without file' : `Unexpected status: ${response.status}`);
    return success;
  } catch (error) {
    logTest('Missing file rejection', false, error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n=== STT Integration Tests ===\n', 'blue');
  log(`Testing server: ${serverUrl}\n`, 'blue');
  
  // Check if server is reachable first
  const isReachable = await testServerReachable();
  if (!isReachable) {
    log('\n❌ Server not reachable, aborting tests', 'red');
    process.exit(1);
  }
  
  // Check if audio file exists
  await testAudioFileExists();
  
  // Run tests
  await testWhisperModelAvailable();
  await testBasicTranscription();
  await testVerboseTranscription();
  await testModelSwitchingLLMtoSTT();
  await testModelSwitchingSTTtoLLM();
  await testInvalidFileType();
  await testMissingFile();
  
  // Summary
  const total = testsPassed + testsFailed;
  log(`\n=== Test Summary ===`, 'blue');
  log(`Total: ${total}`, 'gray');
  log(`Passed: ${testsPassed}`, 'green');
  log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'gray');
  
  if (testsFailed === 0) {
    log('\n✅ All tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some tests failed', 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test runner error: ${error.message}`, 'red');
  process.exit(1);
});
