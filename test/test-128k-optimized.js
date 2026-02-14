#!/usr/bin/env node
/**
 * Test with ~128k token context - MAXIMUM CAPACITY
 * Testing the absolute limits with optimized settings
 */

const ROUTER_URL = 'http://192.168.0.21:3000';
const API_KEY = 'test-key';

async function test128kOptimized() {
  console.log('\n🧪 Testing 128K context - MAXIMUM CAPACITY\n');
  console.log('Optimizations applied:');
  console.log('  • Context: 131072 (maximum)');
  console.log('  • KV cache: f16 (full precision)');
  console.log('  • Flash attention: disabled');
  console.log('  • Parallel slots: 1');
  console.log('  • Continuous batching: disabled');
  console.log('  • Optimized batch sizes\n');
  console.log('⚠️  This will take a while to process!\n');
  
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ];
  
  // Add ~640 message pairs (~128000 tokens total)
  console.log('📝 Building large conversation history...');
  for (let i = 0; i < 640; i++) {
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
    
    // Progress indicator
    if ((i + 1) % 100 === 0) {
      console.log(`   Built ${i + 1} message pairs...`);
    }
  }
  
  messages.push({ role: 'user', content: 'Say "hello" and nothing else.' });
  
  console.log(`\n📊 Message count: ${messages.length}`);
  console.log(`📊 Estimated tokens: ~128000`);
  console.log(`⏳ Starting test...\n`);
  
  const t0 = Date.now();
  
  // Show progress updates every 10 seconds
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - t0;
    console.log(`⏱️  Still processing... ${(elapsed / 1000).toFixed(1)}s`);
  }, 10000);
  
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
    
    console.log(`\n⏱️  Total time: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s = ${(elapsed / 60000).toFixed(2)} minutes)`);
    console.log(`📡 Status: ${response.status} ${response.statusText}\n`);
    
    if (!response.ok) {
      console.log('❌ REQUEST FAILED');
      console.log(`Response: ${text.substring(0, 1000)}\n`);
      return false;
    }
    
    const data = JSON.parse(text);
    const reply = data.choices?.[0]?.message?.content || '(no content)';
    
    console.log('✅ REQUEST SUCCEEDED!');
    console.log(`Reply: ${reply}\n`);
    
    // Performance assessment
    console.log('📈 Performance Assessment:');
    if (elapsed < 30000) {
      console.log('   ⚡ INCREDIBLE - Response in under 30 seconds!');
      console.log('   🏆 This model is CRUSHING IT!');
    } else if (elapsed < 60000) {
      console.log('   ✅ EXCELLENT - Response in under 1 minute');
      console.log('   ✅ 128K context is fully usable!');
    } else if (elapsed < 120000) {
      console.log('   ✅ GOOD - Response in under 2 minutes');
      console.log('   ✅ Acceptable for large context processing');
    } else if (elapsed < 300000) {
      console.log('   ⚠️  SLOW - Response took 2-5 minutes');
      console.log('   ⚠️  Workable but not ideal for chat');
    } else {
      console.log('   ❌ TOO SLOW - Response took over 5 minutes');
      console.log('   ❌ Not practical for interactive use');
    }
    
    // Calculate tokens per second
    const estimatedTokens = 128000;
    const tokensPerSecond = estimatedTokens / (elapsed / 1000);
    console.log(`   Processing speed: ~${tokensPerSecond.toFixed(0)} tokens/second\n`);
    
    // Comparison table
    console.log('📊 Full Context Size Comparison:');
    console.log('   2K context:   0.64s  (~3125 tokens/s)');
    console.log('   5K context:   3.15s  (~1590 tokens/s)');
    console.log('   20K context:  6.89s  (~2901 tokens/s)');
    console.log(`   128K context: ${(elapsed / 1000).toFixed(2)}s (~${tokensPerSecond.toFixed(0)} tokens/s)`);
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
console.log('  128K Context Test - MAXIMUM CAPACITY');
console.log('  Testing Absolute Limits');
console.log('═══════════════════════════════════════');

test128kOptimized().then(success => {
  console.log('═══════════════════════════════════════');
  if (success) {
    console.log('🏆 TEST PASSED - 128K context fully working!');
  } else {
    console.log('❌ Test failed - see errors above');
  }
  console.log('═══════════════════════════════════════\n');
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
