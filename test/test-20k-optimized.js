#!/usr/bin/env node
/**
 * Test with ~20k token context using optimized llama.cpp settings
 * Push the limits with the new configuration
 */

const ROUTER_URL = 'http://192.168.0.21:3000';
const API_KEY = 'test-key';

async function test20kOptimized() {
  console.log('\n🧪 Testing 20K context with optimized settings\n');
  console.log('Optimizations applied:');
  console.log('  • Context: 8192 (vs 131k)');
  console.log('  • KV cache: f16 (vs q4_0)');
  console.log('  • Flash attention: disabled');
  console.log('  • Parallel slots: 2');
  console.log('  • Continuous batching: disabled');
  console.log('  • Smaller batch sizes\n');
  
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ];
  
  // Add ~100 message pairs (~20000 tokens total)
  for (let i = 0; i < 100; i++) {
    messages.push(
      { 
        role: 'user', 
        content: `Message ${i}: This is a test message with some reasonable content to simulate a real conversation. Adding enough text to reach realistic token counts for a chat with substantial history. The user is discussing various topics and expecting helpful detailed responses from the assistant. ${Math.random()}`
      },
      { 
        role: 'assistant', 
        content: `Response ${i}: I acknowledge your message and provide a detailed response with useful information and comprehensive context. Here's some additional content to make this feel like a real assistant response with substance and depth. I'm including multiple sentences to better simulate realistic assistant behavior. ${Math.random()}`
      }
    );
  }
  
  messages.push({ role: 'user', content: 'Say "hello" and nothing else.' });
  
  console.log(`📊 Message count: ${messages.length}`);
  console.log(`📊 Estimated tokens: ~20000`);
  console.log(`⏳ Starting test...\n`);
  
  const t0 = Date.now();
  
  // Show progress updates every 5 seconds
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - t0;
    console.log(`⏱️  Still waiting... ${(elapsed / 1000).toFixed(1)}s`);
  }, 5000);
  
  try {
    const response = await fetch(`${ROUTER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'lols-smart',
        messages: messages,
        stream: false,
        max_tokens: 50
      })
    });
    
    clearInterval(progressInterval);
    
    const elapsed = Date.now() - t0;
    const text = await response.text();
    
    console.log(`\n⏱️  Total time: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);
    console.log(`📡 Status: ${response.status} ${response.statusText}\n`);
    
    if (!response.ok) {
      console.log('❌ REQUEST FAILED');
      console.log(`Response: ${text.substring(0, 500)}\n`);
      return false;
    }
    
    const data = JSON.parse(text);
    const reply = data.choices?.[0]?.message?.content || '(no content)';
    
    console.log('✅ REQUEST SUCCEEDED');
    console.log(`Reply: ${reply}\n`);
    
    // Performance assessment
    console.log('📈 Performance Assessment:');
    if (elapsed < 5000) {
      console.log('   ⚡ EXCELLENT - Response in under 5 seconds');
      console.log('   ✅ Optimizations working perfectly!');
    } else if (elapsed < 15000) {
      console.log('   ✅ GOOD - Response in under 15 seconds');
      console.log('   ✅ KV cache working with larger context');
    } else if (elapsed < 30000) {
      console.log('   ⚠️  ACCEPTABLE - Response took 15-30 seconds');
      console.log('   ⚠️  At the limit for this context size');
    } else if (elapsed < 60000) {
      console.log('   ❌ SLOW - Response took 30-60 seconds');
      console.log('   ❌ Too slow for interactive use');
    } else {
      console.log('   ❌ FAILED - Response took over 1 minute');
      console.log('   ❌ Context size too large');
    }
    
    // Calculate tokens per second
    const estimatedTokens = 20000;
    const tokensPerSecond = estimatedTokens / (elapsed / 1000);
    console.log(`   Processing speed: ~${tokensPerSecond.toFixed(0)} tokens/second\n`);
    
    // Comparison with 5k test
    console.log('📊 Comparison with 5K test:');
    console.log('   5K context:  3.15s (~1590 tokens/s)');
    console.log(`   20K context: ${(elapsed / 1000).toFixed(2)}s (~${tokensPerSecond.toFixed(0)} tokens/s)`);
    console.log('');
    
    return true;
    
  } catch (err) {
    clearInterval(progressInterval);
    const elapsed = Date.now() - t0;
    console.log(`\n⏱️  Time before error: ${elapsed}ms`);
    console.log(`❌ Error: ${err.message}\n`);
    return false;
  }
}

// Run test
console.log('═══════════════════════════════════════');
console.log('  20K Context Optimized Test');
console.log('  Pushing the Limits');
console.log('═══════════════════════════════════════');

test20kOptimized().then(success => {
  console.log('═══════════════════════════════════════');
  if (success) {
    console.log('✅ Test completed - see results above');
  } else {
    console.log('❌ Test failed - see errors above');
  }
  console.log('═══════════════════════════════════════\n');
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
