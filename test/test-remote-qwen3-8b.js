#!/usr/bin/env node
/**
 * Remote test for qwen3-8b-instruct
 */

const SERVER_URL = 'http://localhost:3000';

async function testQwen3_8B() {
  console.log('🧪 Testing qwen3-8b-instruct on remote server...\n');
  
  try {
    // Test 1: Check if model is listed
    console.log('📋 Test 1: Checking if model is listed...');
    const modelsRes = await fetch(`${SERVER_URL}/v1/models`);
    const models = await modelsRes.json();
    const qwen3_8b = models.data.find(m => m.id === 'qwen3-8b-instruct');
    
    if (qwen3_8b) {
      console.log('✅ qwen3-8b-instruct is listed in models\n');
    } else {
      console.log('❌ qwen3-8b-instruct NOT found in models list');
      console.log('Available models:', models.data.map(m => m.id).join(', '));
      process.exit(1);
    }
    
    // Test 2: Simple completion
    console.log('💬 Test 2: Testing simple completion...');
    console.log('⏳ This may take 30-60 seconds for first request (model loading)...');
    const startTime = Date.now();
    
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      console.log('❌ Request timeout after 90 seconds');
    }, 90000);
    
    const completionRes = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-8b-instruct',
        messages: [
          { role: 'user', content: 'Say "Hello from qwen3-8b!" and nothing else.' }
        ],
        max_tokens: 50
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    
    if (!completionRes.ok) {
      const error = await completionRes.text();
      console.log('❌ Request failed:', completionRes.status);
      console.log(error);
      process.exit(1);
    }
    
    const completion = await completionRes.json();
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('✅ Response received in', duration, 'seconds');
    console.log('📝 Response:', completion.choices[0].message.content);
    console.log('📊 Tokens:', completion.usage.completion_tokens, 'tokens');
    
    if (completion.usage.completion_tokens > 0) {
      const tokensPerSec = (completion.usage.completion_tokens / (endTime - startTime) * 1000).toFixed(2);
      console.log('⚡ Speed:', tokensPerSec, 'tokens/sec\n');
    }
    
    // Test 3: Check lols-smart routing
    console.log('🧠 Test 3: Testing lols-smart routing (should use qwen3-8b for chat)...');
    const routingStart = Date.now();
    
    const routingRes = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [
          { role: 'user', content: 'Hi there! How are you?' }
        ],
        max_tokens: 50
      })
    });
    
    if (!routingRes.ok) {
      console.log('❌ lols-smart routing failed:', routingRes.status);
      process.exit(1);
    }
    
    const routingCompletion = await routingRes.json();
    const routingEnd = Date.now();
    const routingDuration = ((routingEnd - routingStart) / 1000).toFixed(2);
    
    console.log('✅ lols-smart routing works');
    console.log('📝 Response:', routingCompletion.choices[0].message.content);
    console.log('⏱️  Duration:', routingDuration, 'seconds\n');
    
    console.log('✅ All tests passed! qwen3-8b-instruct is working on remote server! 🎉');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testQwen3_8B();
