#!/usr/bin/env node
/**
 * OpenClaw Large Context Test
 * Simulates realistic large context requests that OpenClaw sends
 */

const SERVER_URL = process.env.SERVER_URL || 'http://192.168.0.21:3000';

/**
 * Build a realistic OpenClaw-style conversation with large context
 * @param {number} messageCount - Number of user/assistant message pairs
 * @param {boolean} includeTools - Whether to include tool definitions
 * @returns {object} - Complete request payload
 */
function buildOpenClawConversation(messageCount = 50, includeTools = false) {
  const messages = [];
  
  // System message (OpenClaw always includes this)
  messages.push({
    role: 'system',
    content: 'You are a helpful AI assistant with access to tools. Be concise and helpful. Current date: 2026-02-13.'
  });
  
  // Add conversation history
  const topics = [
    'Can you help me write a Python script?',
    'I need to debug this code',
    'Explain how async/await works',
    'What are the best practices for API design?',
    'How do I optimize database queries?',
    'Can you review this code snippet?',
    'Help me understand this error message',
    'What are design patterns I should know?',
    'How do I set up CI/CD?',
    'Explain Docker containers'
  ];
  
  for (let i = 0; i < messageCount; i++) {
    const topic = topics[i % topics.length];
    
    // User message
    messages.push({
      role: 'user',
      content: `${topic} (message ${i + 1}). Here's some additional context: ${'x'.repeat(100)}`
    });
    
    // Assistant response
    messages.push({
      role: 'assistant',
      content: `Sure! I'd be happy to help with that. ${i % 3 === 0 ? 'Let me explain in detail. ' : ''}${'Response content. '.repeat(50)}`
    });
  }
  
  // Add the actual user question at the end
  messages.push({
    role: 'user',
    content: 'Now write me a simple hello world script'
  });
  
  const payload = {
    model: 'lols-smart',
    messages: messages,
    stream: false,
    max_tokens: 100
  };
  
  // Optionally include tool definitions (OpenClaw does this)
  if (includeTools) {
    payload.tools = [
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read contents of a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Write content to a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
              content: { type: 'string', description: 'File content' }
            },
            required: ['path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'exec',
          description: 'Execute a shell command',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Shell command' }
            },
            required: ['command']
          }
        }
      }
    ];
  }
  
  return payload;
}

/**
 * Calculate approximate token count
 */
function estimateTokens(payload) {
  const jsonStr = JSON.stringify(payload);
  return Math.floor(jsonStr.length / 4); // Rough estimate: 4 chars per token
}

/**
 * Test with specific context size
 */
async function testContextSize(messageCount, includeTools = false, timeoutSec = 60) {
  const payload = buildOpenClawConversation(messageCount, includeTools);
  const estimatedTokens = estimateTokens(payload);
  const payloadSizeKB = (JSON.stringify(payload).length / 1024).toFixed(2);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 Testing ${messageCount} message pairs`);
  console.log(`${'='.repeat(70)}`);
  console.log(`📊 Total messages: ${payload.messages.length}`);
  console.log(`📦 Payload size: ${payloadSizeKB} KB`);
  console.log(`🧮 Estimated tokens: ~${estimatedTokens}`);
  console.log(`🔧 Tools included: ${includeTools ? 'Yes' : 'No'}`);
  console.log(`⏱️  Timeout: ${timeoutSec}s\n`);
  
  const startTime = Date.now();
  
  try {
    console.log('📤 Sending request...');
    
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutSec * 1000)
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`\n❌ FAILED: HTTP ${response.status} (${elapsed}s)`);
      console.log(`Error: ${errorText.substring(0, 200)}`);
      return false;
    }
    
    const data = await response.json();
    
    console.log(`\n✅ SUCCESS in ${elapsed}s`);
    console.log(`📝 Response: ${data.choices[0].message.content.substring(0, 100)}...`);
    
    if (data.usage) {
      console.log(`📊 Tokens: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`);
      const tps = (data.usage.completion_tokens / elapsed).toFixed(2);
      console.log(`⚡ Speed: ${tps} tokens/sec`);
      
      // Compare estimated vs actual
      const estimateAccuracy = ((data.usage.prompt_tokens / estimatedTokens) * 100).toFixed(1);
      console.log(`🎯 Token estimate accuracy: ${estimateAccuracy}%`);
    }
    
    return true;
    
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.log(`\n❌ TIMEOUT after ${elapsed}s`);
      console.log(`💡 The model may be processing but taking too long`);
      console.log(`   Consider: reducing context, using faster model, or increasing timeout`);
    } else {
      console.log(`\n❌ ERROR after ${elapsed}s: ${error.message}`);
    }
    
    return false;
  }
}

async function main() {
  console.log('🚀 OpenClaw Large Context Test Suite');
  console.log(`🌐 Server: ${SERVER_URL}\n`);
  
  // Check server is up
  console.log('🏥 Checking server status...');
  try {
    const response = await fetch(`${SERVER_URL}/v1/models`, {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      console.log('✅ Server is up\n');
    } else {
      console.log(`❌ Server returned HTTP ${response.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.log(`❌ Cannot reach server: ${error.message}`);
    process.exit(1);
  }
  
  let passed = 0;
  let failed = 0;
  
  // Test progression: small → medium → large → very large
  const tests = [
    { messageCount: 10, includeTools: false, timeout: 30, name: 'Small context (10 pairs)' },
    { messageCount: 25, includeTools: false, timeout: 45, name: 'Medium context (25 pairs)' },
    { messageCount: 50, includeTools: false, timeout: 60, name: 'Large context (50 pairs)' },
    { messageCount: 50, includeTools: true, timeout: 60, name: 'Large context with tools' },
    { messageCount: 100, includeTools: false, timeout: 90, name: 'Very large context (100 pairs)' }
  ];
  
  for (const test of tests) {
    const result = await testContextSize(test.messageCount, test.includeTools, test.timeout);
    result ? passed++ : failed++;
    
    // Wait a bit between tests to let model settle
    if (tests.indexOf(test) < tests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(70)}`);
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  
  if (failed > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('  - Reduce contextWindow in OpenClaw config for this model');
    console.log('  - Use isolated sessions for complex tasks (less history)');
    console.log('  - Consider using a faster/larger model for long conversations');
    console.log('  - Monitor GPU memory and processing speed on the server');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! lols-router handles large OpenClaw contexts well.');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
