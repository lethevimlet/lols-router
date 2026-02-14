#!/usr/bin/env node
/**
 * Test with ~2k token context
 * See if the 7B model can handle reasonable context sizes
 */

const ROUTER_URL = 'http://192.168.0.21:3000';
const API_KEY = 'test-key';

async function test2kContext() {
  console.log('\n🧪 Testing with ~2k token context\n');
  
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ];
  
  // Add ~10 message pairs (~2000 tokens total)
  for (let i = 0; i < 10; i++) {
    messages.push(
      { 
        role: 'user', 
        content: `Message ${i}: This is a test message with some reasonable content to simulate a real conversation. Adding enough text to reach realistic token counts for a short chat. The user is asking about various topics and expecting helpful responses. ${Math.random()}`
      },
      { 
        role: 'assistant', 
        content: `Response ${i}: I acknowledge your message and provide a detailed response with useful information and context. Here's some additional content to make this feel like a real assistant response with substance. ${Math.random()}`
      }
    );
  }
  
  messages.push({ role: 'user', content: 'hi' });
  
  console.log(`📊 Message count: ${messages.length}`);
  console.log(`📊 Estimated tokens: ~2000\n`);
  
  const t0 = Date.now();
  
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
    
    const elapsed = Date.now() - t0;
    const text = await response.text();
    
    console.log(`⏱️  Total time: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);
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
      console.log('   ⚠️  SLOW - Response took over 10 seconds');
    } else {
      console.log('   ❌ TOO SLOW - Response took over 30 seconds');
    }
    
    return true;
    
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.log(`⏱️  Time before error: ${elapsed}ms`);
    console.log(`❌ Error: ${err.message}\n`);
    return false;
  }
}

// Run test
console.log('═══════════════════════════════════════');
console.log('  2K Context Speed Test');
console.log('═══════════════════════════════════════');

test2kContext().then(success => {
  console.log('═══════════════════════════════════════');
  if (success) {
    console.log('✅ Test passed - model can handle 2k context');
  } else {
    console.log('❌ Test failed - see errors above');
  }
  console.log('═══════════════════════════════════════\n');
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
