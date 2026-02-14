#!/usr/bin/env node
/**
 * Test with ~10k token context
 * Finding the breaking point between 2k (works) and 20k (hangs)
 */

const ROUTER_URL = 'http://192.168.0.21:3000';
const API_KEY = 'test-key';

async function test10kContext() {
  console.log('\n🧪 Testing with ~10k token context\n');
  
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ];
  
  // Add ~50 message pairs (~10000 tokens total)
  for (let i = 0; i < 50; i++) {
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
  
  messages.push({ role: 'user', content: 'hi' });
  
  console.log(`📊 Message count: ${messages.length}`);
  console.log(`📊 Estimated tokens: ~10000`);
  console.log(`⏳ Starting test...\n`);
  
  const t0 = Date.now();
  
  // Show progress updates every 5 seconds
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - t0;
    console.log(`⏱️  Still waiting... ${(elapsed / 1000).toFixed(1)}s elapsed`);
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
    if (elapsed < 3000) {
      console.log('   ⚡ EXCELLENT - Response in under 3 seconds');
    } else if (elapsed < 10000) {
      console.log('   ✅ GOOD - Response in under 10 seconds');
    } else if (elapsed < 30000) {
      console.log('   ⚠️  ACCEPTABLE - Response took 10-30 seconds');
    } else if (elapsed < 60000) {
      console.log('   ❌ SLOW - Response took 30-60 seconds');
    } else {
      console.log('   ❌ TOO SLOW - Response took over 1 minute');
    }
    
    // Calculate tokens per second
    const estimatedTokens = 10000;
    const tokensPerSecond = estimatedTokens / (elapsed / 1000);
    console.log(`   Processing speed: ~${tokensPerSecond.toFixed(0)} tokens/second\n`);
    
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
console.log('  10K Context Speed Test');
console.log('═══════════════════════════════════════');

test10kContext().then(success => {
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
