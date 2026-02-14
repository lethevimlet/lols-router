#!/usr/bin/env node
/**
 * Test OpenClaw Integration Issue
 * 
 * Simulates what OpenClaw is actually sending and debugs the issue
 */

// Use Node.js built-in fetch (available in Node 18+)

const ROUTER_URL = 'http://192.168.0.21:3000';
const API_KEY = 'test-key';

async function testOpenClawRequest() {
  console.log('\n🧪 Testing OpenClaw Integration\n');
  
  // Simulate OpenClaw sending a large context (like it's doing now)
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ];
  
  // Add many messages to simulate 80k tokens
  for (let i = 0; i < 200; i++) {
    messages.push(
      { role: 'user', content: `Message ${i}: This is a test message to simulate a large conversation history. Adding more content to reach realistic token counts. ${Math.random()}` },
      { role: 'assistant', content: `Response ${i}: I acknowledge your message and provide a detailed response with additional context and information. ${Math.random()}` }
    );
  }
  
  messages.push({ role: 'user', content: 'hi' });
  
  console.log(`📊 Sending ${messages.length} messages`);
  console.log(`📊 Estimated tokens: ~${messages.length * 100} (rough estimate)\n`);
  
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
        max_tokens: 100
      })
    });
    
    const elapsed = Date.now() - t0;
    const text = await response.text();
    
    console.log(`⏱️  Request took: ${elapsed}ms`);
    console.log(`📡 Status: ${response.status} ${response.statusText}`);
    console.log(`📝 Response length: ${text.length} bytes\n`);
    
    if (!response.ok) {
      console.log('❌ REQUEST FAILED');
      console.log(`Response body: ${text}\n`);
      
      // Parse error if JSON
      try {
        const data = JSON.parse(text);
        if (data.error) {
          console.log(`Error: ${data.error}`);
        }
      } catch (e) {
        // Not JSON
      }
      
      return false;
    }
    
    const data = JSON.parse(text);
    const reply = data.choices?.[0]?.message?.content || '(no content)';
    
    console.log('✅ REQUEST SUCCEEDED');
    console.log(`Reply: ${reply.substring(0, 200)}\n`);
    
    return true;
    
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

// Test with progressively smaller contexts
async function testWithDifferentSizes() {
  console.log('\n🔬 Testing with different message counts\n');
  
  const sizes = [10, 20, 50, 100, 200];
  
  for (const size of sizes) {
    const messages = [
      { role: 'system', content: 'You are a helpful AI assistant.' }
    ];
    
    for (let i = 0; i < size; i++) {
      messages.push(
        { role: 'user', content: `Message ${i}` },
        { role: 'assistant', content: `Response ${i}` }
      );
    }
    
    messages.push({ role: 'user', content: 'hi' });
    
    console.log(`\n📊 Testing with ${messages.length} messages...`);
    
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
      
      const text = await response.text();
      
      if (response.ok) {
        console.log(`✅ ${messages.length} messages: SUCCESS`);
      } else {
        console.log(`❌ ${messages.length} messages: FAILED (${response.status})`);
        console.log(`   Error: ${text.substring(0, 200)}`);
      }
      
    } catch (err) {
      console.log(`❌ ${messages.length} messages: ERROR - ${err.message}`);
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  OpenClaw Integration Debug Test');
  console.log('═══════════════════════════════════════\n');
  
  // First test: Simulate what OpenClaw is actually doing
  const result = await testOpenClawRequest();
  
  if (!result) {
    // If it failed, try with different sizes to find the breaking point
    await testWithDifferentSizes();
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('  Test Complete');
  console.log('═══════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
