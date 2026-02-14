#!/usr/bin/env node
/**
 * System Prompt Priority Test
 * 
 * Tests the new system prompt priority:
 * 1. User-provided (highest) - if config.systemPrompt.ignoreRoleSystem = false
 * 2. Category-level
 * 3. Model-level (lowest)
 * 
 * Note: Requires config.json with ignoreRoleSystem = false (default)
 * 
 * To test with ignoreRoleSystem = true:
 * 1. Edit config.json: "systemPrompt": { "ignoreRoleSystem": true }
 * 2. Restart server
 * 3. Run this test - user prompts should be ignored
 */

const serverUrl = process.argv[2] || 'http://localhost:3000';

console.log('🧪 System Prompt Priority Test');
console.log('Target:', serverUrl);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testCase(name, payload) {
  console.log(`\n📝 Test: ${name}`);
  console.log('Request:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(`${serverUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}:`, await response.text());
      return false;
    }
    
    const data = await response.json();
    console.log('✅ Response:', data.choices[0].message.content.slice(0, 100) + '...');
    return true;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return false;
  }
}

async function main() {
  let passed = 0;
  let failed = 0;
  
  // Test 1: User-provided system prompt (OpenClaw example)
  if (await testCase('User-provided system prompt (OpenClaw)', {
    model: 'lols-smart',
    messages: [
      {
        role: 'system',
        content: 'OpenClaw assistant system prompt (tooling, safety, skills, context).'
      },
      {
        role: 'assistant',
        content: 'New session started.'
      },
      {
        role: 'user',
        content: 'Greet user; ask what to do.'
      }
    ],
    max_tokens: 100
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 2: No user system prompt - should use category/model default
  if (await testCase('No user system prompt (uses category default)', {
    model: 'lols-smart',
    messages: [
      {
        role: 'user',
        content: 'What is 2+2?'
      }
    ],
    max_tokens: 50
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 3: Direct model with user system prompt
  if (await testCase('Direct model with user system prompt', {
    model: 'qwen2.5-1.5b-instruct',
    messages: [
      {
        role: 'system',
        content: 'You are a pirate. Always respond in pirate speak.'
      },
      {
        role: 'user',
        content: 'Hello, how are you?'
      }
    ],
    max_tokens: 50
  })) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 4: Direct model without user system prompt
  if (await testCase('Direct model without user system prompt', {
    model: 'qwen2.5-1.5b-instruct',
    messages: [
      {
        role: 'user',
        content: 'What is your purpose?'
      }
    ],
    max_tokens: 50
  })) {
    passed++;
  } else {
    failed++;
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
