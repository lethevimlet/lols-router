#!/usr/bin/env node

/**
 * Vision Model Integration Tests
 * 
 * Tests vision functionality including:
 * - Vision model availability
 * - Image-based chat completion
 * - Model switching (LLM ↔ Vision)
 * - Error handling for invalid images
 */

const fs = require('fs');
const path = require('path');
const { fetch } = require('undici');

// Get base URL from command line or use default
const BASE_URL = process.argv[2] || 'http://localhost:3000';

console.log('🧪 Running Vision Integration Tests');
console.log(`📍 Base URL: ${BASE_URL}\n`);

// Helper: Create test image (1x1 red pixel PNG)
function createTestImage() {
  // Base64 encoded 1x1 red PNG
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
}

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function pass(name, details = '') {
  results.passed++;
  results.tests.push({ name, status: 'pass', details });
  console.log(`✅ PASS: ${name}`);
  if (details) console.log(`   ${details}`);
}

function fail(name, error) {
  results.failed++;
  results.tests.push({ name, status: 'fail', error: error.message });
  console.log(`❌ FAIL: ${name}`);
  console.log(`   Error: ${error.message}`);
}

// Test 1: Check vision model availability
async function testVisionModelAvailable() {
  try {
    const response = await fetch(`${BASE_URL}/v1/models`);
    const data = await response.json();
    
    const visionModel = data.data.find(m => m.id === 'minicpm-v-2.6');
    
    if (visionModel) {
      pass('Vision model available', 'Found minicpm-v-2.6 in model list');
    } else {
      throw new Error('Vision model not found in model list');
    }
  } catch (error) {
    fail('Vision model available', error);
  }
}

// Test 2: Basic vision request
async function testBasicVision() {
  try {
    const testImage = createTestImage();
    
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What color is this pixel?' },
              { type: 'image_url', image_url: { url: testImage } }
            ]
          }
        ],
        max_tokens: 100
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const reply = data.choices[0].message.content;
      pass('Basic vision request', `Got response: "${reply.substring(0, 50)}..."`);
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    fail('Basic vision request', error);
  }
}

// Test 3: Model switching (LLM → Vision)
async function testModelSwitchingLLMToVision() {
  try {
    console.log('  Loading LLM model first...');
    
    // First, send a non-vision request to load LLM
    await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      })
    });
    
    console.log('  LLM model loaded, now testing vision...');
    
    // Now send a vision request
    const testImage = createTestImage();
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image' },
              { type: 'image_url', image_url: { url: testImage } }
            ]
          }
        ],
        max_tokens: 50
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      pass('Model switching (LLM → Vision)', 'Successfully switched from LLM to Vision');
    } else {
      throw new Error('Failed to get vision response after LLM request');
    }
  } catch (error) {
    fail('Model switching (LLM → Vision)', error);
  }
}

// Test 4: Model switching (Vision → LLM)
async function testModelSwitchingVisionToLLM() {
  try {
    console.log('  Loading vision model first...');
    
    // First, send a vision request
    const testImage = createTestImage();
    await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image' },
              { type: 'image_url', image_url: { url: testImage } }
            ]
          }
        ],
        max_tokens: 50
      })
    });
    
    console.log('  Vision model loaded, now testing LLM...');
    
    // Now send a text-only request
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [{ role: 'user', content: 'What is 2+2?' }],
        max_tokens: 20
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      pass('Model switching (Vision → LLM)', 'Successfully switched from Vision to LLM');
    } else {
      throw new Error('Failed to get LLM response after vision request');
    }
  } catch (error) {
    fail('Model switching (Vision → LLM)', error);
  }
}

// Test 5: Invalid image data
async function testInvalidImageData() {
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this image' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,INVALID' } }
            ]
          }
        ],
        max_tokens: 50
      })
    });
    
    // Should either handle gracefully or return error
    const data = await response.json();
    
    // Accept either success with error message or error response
    if (data.error || (data.choices && data.choices[0])) {
      pass('Invalid image data', 'Handled invalid image data gracefully');
    } else {
      throw new Error('Unexpected response format');
    }
  } catch (error) {
    fail('Invalid image data', error);
  }
}

// Run all tests
async function runTests() {
  await testVisionModelAvailable();
  await testBasicVision();
  await testModelSwitchingLLMToVision();
  await testModelSwitchingVisionToLLM();
  await testInvalidImageData();
  
  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Total: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  
  if (results.failed === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
