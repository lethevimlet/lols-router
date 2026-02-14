#!/usr/bin/env node
/**
 * Debug test to see WHERE large context requests hang
 */

const SERVER_URL = 'http://192.168.0.21:3000';

async function debugTest() {
  console.log('🔍 Debugging large context hang...\n');
  
  // Build a realistic large context (similar to OpenClaw)
  const messages = [];
  messages.push({ role: 'system', content: 'You are a helpful AI assistant.' });
  
  // Add 50 message pairs (100 messages total)
  for (let i = 0; i < 50; i++) {
    messages.push(
      { role: 'user', content: `User message ${i}: ${'x'.repeat(100)}` },
      { role: 'assistant', content: `Assistant response ${i}: ${'y'.repeat(150)}` }
    );
  }
  
  messages.push({ role: 'user', content: 'Say hi' });
  
  const bodySize = JSON.stringify(messages).length;
  const estimatedTokens = Math.floor(bodySize / 4);
  
  console.log(`📊 Messages: ${messages.length}`);
  console.log(`📦 Size: ${(bodySize / 1024).toFixed(2)} KB`);
  console.log(`🧮 Est. tokens: ~${estimatedTokens}\n`);
  
  const requestBody = {
    model: 'lols-smart',
    messages: messages,
    stream: false,
    max_tokens: 10
  };
  
  console.log('⏱️  Sending request...');
  console.log('(Will timeout after 30s)\n');
  
  const startTime = Date.now();
  let checkpointTime = startTime;
  
  const logCheckpoint = (msg) => {
    const elapsed = ((Date.now() - checkpointTime) / 1000).toFixed(2);
    const total = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[+${elapsed}s / ${total}s] ${msg}`);
    checkpointTime = Date.now();
  };
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      logCheckpoint('❌ TIMEOUT - Aborting request');
      controller.abort();
    }, 30000);
    
    logCheckpoint('Initiating fetch...');
    
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-Timeout': '60' // Try to tell server to wait longer
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    logCheckpoint(`Received response (HTTP ${response.status})`);
    
    if (!response.ok) {
      const errorText = await response.text();
      logCheckpoint('Read error body');
      console.log(`\n❌ HTTP ${response.status}`);
      console.log(errorText.substring(0, 500));
      return;
    }
    
    logCheckpoint('Parsing JSON...');
    const data = await response.json();
    
    logCheckpoint('✅ SUCCESS');
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Completed in ${totalTime}s`);
    console.log(`📝 Response: ${data.choices[0].message.content}`);
    
    if (data.usage) {
      console.log(`📊 Prompt tokens: ${data.usage.prompt_tokens}`);
      console.log(`📊 Completion tokens: ${data.usage.completion_tokens}`);
      
      // Calculate speeds
      const promptSpeed = (data.usage.prompt_tokens / totalTime).toFixed(2);
      const completionSpeed = (data.usage.completion_tokens / totalTime).toFixed(2);
      console.log(`⚡ Prompt processing: ${promptSpeed} t/s`);
      console.log(`⚡ Generation: ${completionSpeed} t/s`);
    }
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (error.name === 'AbortError') {
      console.log(`\n❌ Request timed out after ${elapsed}s`);
      console.log('\n🔍 This means:');
      console.log('   - Request reached the server');
      console.log('   - Server is processing but not responding within 30s');
      console.log('   - Likely: prompt processing taking too long');
      console.log('\n💡 Check on server:');
      console.log('   pm2 logs lols-router --lines 50');
      console.log('   (Look for GPU usage, model loading, or stuck requests)');
    } else {
      console.log(`\n❌ Error after ${elapsed}s: ${error.message}`);
    }
  }
}

async function quickTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🔬 Quick test with SMALL context first...\n');
  
  try {
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        max_tokens: 10
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Small context works fine');
      console.log(`📝 Response: ${data.choices[0].message.content}\n`);
      console.log('='.repeat(70));
      return true;
    } else {
      console.log('❌ Even small context fails!');
      return false;
    }
  } catch (error) {
    console.log(`❌ Small context error: ${error.message}`);
    return false;
  }
}

async function main() {
  // First verify small requests work
  const smallWorks = await quickTest();
  
  if (!smallWorks) {
    console.log('\n❌ Server not responding even to small requests. Check if lols-router is running.');
    process.exit(1);
  }
  
  // Now test large context
  await debugTest();
}

main();
