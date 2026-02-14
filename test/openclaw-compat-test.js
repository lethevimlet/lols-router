#!/usr/bin/env node
/**
 * OpenClaw Compatibility Test
 * Tests lols-router with OpenClaw-style requests to debug hanging issues
 */

const SERVER_URL = process.env.SERVER_URL || 'http://192.168.0.21:3000';

// Simulate a typical OpenClaw conversation with multiple messages
function buildOpenClawStyleRequest(userMessage, includeHistory = false) {
  const messages = [];
  
  // OpenClaw often includes a system message
  messages.push({
    role: 'system',
    content: 'You are a helpful AI assistant.'
  });
  
  if (includeHistory) {
    // Add some conversation history (simulating what OpenClaw does)
    messages.push(
      { role: 'user', content: 'Hello, can you help me with a task?' },
      { role: 'assistant', content: 'Of course! I\'d be happy to help. What do you need?' },
      { role: 'user', content: 'I need to write some code.' },
      { role: 'assistant', content: 'Great! What kind of code are you looking to write?' }
    );
  }
  
  // Add the actual user message
  messages.push({
    role: 'user',
    content: userMessage
  });
  
  return {
    model: 'lols-smart',
    messages: messages,
    stream: false,
    max_tokens: 100
  };
}

async function testWithTimeout(name, requestBody, timeoutSec = 30) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${name}`);
  console.log(`${'='.repeat(70)}`);
  
  const startTime = Date.now();
  
  try {
    console.log(`📤 Sending request to ${SERVER_URL}/v1/chat/completions`);
    console.log(`📊 Messages count: ${requestBody.messages.length}`);
    console.log(`📝 Last message: "${requestBody.messages[requestBody.messages.length - 1].content.substring(0, 50)}..."`);
    console.log(`⏱️  Timeout: ${timeoutSec}s\n`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.log(`\n⏰ TIMEOUT after ${timeoutSec}s - Request aborted`);
      controller.abort();
    }, timeoutSec * 1000);
    
    // Log progress every 2 seconds
    const progressInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏳ Still waiting... ${elapsed}s elapsed`);
    }, 2000);
    
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    }).finally(() => {
      clearTimeout(timeout);
      clearInterval(progressInterval);
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`\n❌ FAILED: HTTP ${response.status}`);
      console.log(`📄 Error body: ${errorText.substring(0, 500)}`);
      return false;
    }
    
    const data = await response.json();
    
    console.log(`\n✅ SUCCESS in ${duration}s`);
    console.log(`📝 Response: ${data.choices[0].message.content.substring(0, 200)}...`);
    
    if (data.usage) {
      console.log(`📊 Tokens used: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`);
      const tps = (data.usage.completion_tokens / duration).toFixed(2);
      console.log(`⚡ Speed: ${tps} tokens/sec`);
    }
    
    return true;
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (error.name === 'AbortError') {
      console.log(`\n❌ TIMEOUT: Request took longer than ${timeoutSec}s (aborted at ${elapsed}s)`);
      console.log(`🔍 This suggests the server is hanging on this request type`);
    } else {
      console.log(`\n❌ ERROR after ${elapsed}s: ${error.message}`);
      console.log(error.stack);
    }
    
    return false;
  }
}

async function runTests() {
  console.log('🚀 OpenClaw Compatibility Test Suite');
  console.log(`🌐 Server: ${SERVER_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Check server is reachable
  console.log('🏥 Checking if server is up...');
  try {
    const response = await fetch(`${SERVER_URL}/v1/models`, {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const models = await response.json();
      console.log(`✅ Server is up, found ${models.data.length} models`);
    } else {
      console.log(`❌ Server returned HTTP ${response.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.log(`❌ Cannot reach server: ${error.message}`);
    process.exit(1);
  }
  
  // Test 2: Simple message without history
  const test1 = await testWithTimeout(
    'Test 1: Simple "hi" message (no history)',
    buildOpenClawStyleRequest('hi', false),
    20
  );
  test1 ? passed++ : failed++;
  
  // Test 3: Simple message WITH history
  const test2 = await testWithTimeout(
    'Test 2: Simple message with conversation history',
    buildOpenClawStyleRequest('Can you write a hello world in JavaScript?', true),
    30
  );
  test2 ? passed++ : failed++;
  
  // Test 4: Direct model request (bypass router)
  console.log(`\n${'='.repeat(70)}`);
  console.log('🧪 Test 3: Direct model request (bypass lols-smart router)');
  console.log(`${'='.repeat(70)}`);
  
  const test3 = await testWithTimeout(
    'Direct qwen2.5-1.5b-instruct request',
    {
      model: 'qwen2.5-1.5b-instruct',
      messages: [
        { role: 'user', content: 'Say hello in one word' }
      ],
      stream: false,
      max_tokens: 10
    },
    20
  );
  test3 ? passed++ : failed++;
  
  // Test 4: Check streaming support
  console.log(`\n${'='.repeat(70)}`);
  console.log('🧪 Test 4: Streaming request (OpenClaw sometimes uses streaming)');
  console.log(`${'='.repeat(70)}`);
  
  try {
    const startTime = Date.now();
    console.log('📤 Testing streaming...');
    
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [{ role: 'user', content: 'Count from 1 to 5' }],
        stream: true,
        max_tokens: 50
      }),
      signal: AbortSignal.timeout(20000)
    });
    
    if (!response.ok) {
      console.log(`❌ Streaming request failed: HTTP ${response.status}`);
      failed++;
    } else {
      console.log('✅ Streaming response started');
      
      // Read first chunk to verify it works
      const reader = response.body.getReader();
      const { value } = await reader.read();
      
      if (value) {
        console.log('✅ Received streaming data');
        passed++;
      } else {
        console.log('❌ No streaming data received');
        failed++;
      }
      
      reader.cancel();
    }
  } catch (error) {
    console.log(`❌ Streaming test error: ${error.message}`);
    failed++;
  }
  
  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(70)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️  DIAGNOSIS:');
    console.log('If simple requests timeout, the issue is likely:');
    console.log('  1. Router model (qwen2.5-0.5b-instruct) hanging on classification');
    console.log('  2. llama-server processes not starting correctly');
    console.log('  3. GPU lock/orchestration issues');
    console.log('\nCheck lols-router logs on the server:');
    console.log('  pm2 logs lols-router --lines 100');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! lols-router is compatible with OpenClaw requests.');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
