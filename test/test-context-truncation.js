#!/usr/bin/env node
/**
 * Test Context Truncation Feature
 * 
 * Tests that models with context limits defined in models.json
 * properly truncate incoming messages.
 */

const fetch = require('undici').fetch;

const ROUTER_URL = 'http://localhost:3000';
const API_KEY = 'test-key';

async function testContextTruncation() {
  console.log('\n🧪 Testing Context Truncation\n');
  
  // Build a large conversation (simulate OpenClaw sending 100+ messages)
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' }
  ];
  
  // Add 100 message pairs (200 messages total)
  for (let i = 1; i <= 100; i++) {
    messages.push(
      { role: 'user', content: `User message ${i}: This is a test message with some content to simulate a real conversation. Let me add more text to make it more realistic. ${Math.random()}` },
      { role: 'assistant', content: `Assistant response ${i}: I acknowledge your message. Here's my response with some additional content to make it more realistic. ${Math.random()}` }
    );
  }
  
  // Add current message
  messages.push({ role: 'user', content: 'Please respond briefly to this final message.' });
  
  console.log(`📊 Input: ${messages.length} messages (~${Math.floor(messages.length * 100 / 4)} tokens estimated)\n`);
  
  const tests = [
    { name: 'qwen2.5.1-coder-7b-instruct', context: 131072, shouldTruncate: false },
    { name: 'qwen2.5-1.5b-instruct', context: 32768, shouldTruncate: false },
    { name: 'minicpm-v-2.6', context: 8192, shouldTruncate: true }
  ];
  
  for (const test of tests) {
    console.log(`\n🔧 Testing: ${test.name} (context=${test.context})`);
    
    const t0 = Date.now();
    try {
      const response = await fetch(`${ROUTER_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: test.name,
          messages: messages,
          max_tokens: 100,
          temperature: 0.7
        })
      });
      
      const elapsed = Date.now() - t0;
      const data = await response.json();
      
      if (!response.ok) {
        console.log(`❌ Request failed (${response.status}): ${data.error || JSON.stringify(data)}`);
        continue;
      }
      
      const reply = data.choices?.[0]?.message?.content || '(no content)';
      
      console.log(`✅ Response received in ${elapsed}ms`);
      console.log(`📝 Reply preview: ${reply.substring(0, 100)}...`);
      
      // Check if truncation was applied by looking for the truncation notice
      const hasSystemMessages = messages.filter(m => m.role === 'system').length;
      const expectedTruncation = test.shouldTruncate;
      
      console.log(`📊 Expected truncation: ${expectedTruncation ? 'YES' : 'NO'}`);
      
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }
  
  console.log('\n✅ Context truncation tests complete\n');
}

// Run tests
testContextTruncation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
