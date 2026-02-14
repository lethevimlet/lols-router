#!/usr/bin/env node
/**
 * Test with EXACT web UI format
 */

const SERVER_URL = 'http://192.168.0.21:3000';

async function testExactWebUIFormat() {
  console.log('🧪 Testing with EXACT web UI format\n');
  
  // This is EXACTLY what the web UI sends
  const payload = {
    model: 'lols-smart',
    messages: [
      { role: 'user', content: 'hi' }
    ],
    stream: false
  };
  
  console.log('📤 Payload:', JSON.stringify(payload, null, 2));
  console.log('\n⏱️  Sending...\n');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`📥 Response: HTTP ${response.status} (${elapsed}s)`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS');
      console.log('📝 Response:', data.choices[0].message.content);
      if (data.usage) {
        console.log(`📊 Tokens: ${data.usage.total_tokens}`);
      }
    } else {
      const errorText = await response.text();
      console.log('\n❌ FAILED');
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log('\n❌ ERROR:', error.message);
  }
}

async function testWithSystemMessage() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 Testing WITH system message (OpenClaw style)\n');
  
  const payload = {
    model: 'lols-smart',
    messages: [
      { role: 'system', content: 'You are a helpful AI assistant.' },
      { role: 'user', content: 'hi' }
    ],
    stream: false,
    max_tokens: 100
  };
  
  console.log('📤 Payload:', JSON.stringify(payload, null, 2));
  console.log('\n⏱️  Sending...\n');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`📥 Response: HTTP ${response.status} (${elapsed}s)`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS');
      console.log('📝 Response:', data.choices[0].message.content);
    } else {
      const errorText = await response.text();
      console.log('\n❌ FAILED');
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log('\n❌ ERROR:', error.message);
  }
}

async function main() {
  // Test 1: Exact web UI format (no system message)
  await testExactWebUIFormat();
  
  // Test 2: With system message (OpenClaw format)
  await testWithSystemMessage();
}

main();
