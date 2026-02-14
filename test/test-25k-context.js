#!/usr/bin/env node

// Generate a large system prompt to simulate OpenClaw's context (~15k tokens)
const generateLargeSystemPrompt = () => {
  const words = "The quick brown fox jumps over the lazy dog. ".repeat(100); // ~500 tokens
  return words.repeat(30); // ~15k tokens
};

// Generate conversation history (~8k tokens)
const generateConversation = () => {
  const messages = [];
  for (let i = 0; i < 40; i++) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `This is message ${i}. `.repeat(40) // ~200 tokens each
    });
  }
  return messages;
};

async function testLargeContext() {
  console.log('🧪 Testing 25k token context...\n');

  const systemPrompt = generateLargeSystemPrompt();
  const conversation = generateConversation();

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversation,
    { role: 'user', content: 'Create a poem with 20 lines' }
  ];

  // Estimate tokens (rough: 1 token ~= 4 chars)
  const totalChars = JSON.stringify(messages).length;
  const estimatedTokens = Math.floor(totalChars / 4);
  console.log(`📊 Estimated tokens: ~${estimatedTokens.toLocaleString()}`);
  console.log(`📏 Total characters: ${totalChars.toLocaleString()}\n`);

  const startTime = Date.now();

  try {
    const response = await fetch('http://192.168.0.21:3000/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'hermes-3-llama-3.1-8b',
        messages,
        max_tokens: 500,
        stream: false
      })
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (!response.ok) {
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    const data = await response.json();

    console.log(`✅ Response received in ${(duration / 1000).toFixed(2)}s`);
    console.log(`\n📝 Response preview:`);
    console.log(data.choices[0].message.content.substring(0, 200) + '...\n');
    
    if (data.usage) {
      console.log(`📊 Token usage:`);
      console.log(`   Prompt: ${data.usage.prompt_tokens}`);
      console.log(`   Completion: ${data.usage.completion_tokens}`);
      console.log(`   Total: ${data.usage.total_tokens}`);
    }

    if (data.timings) {
      console.log(`\n⏱️  Timings:`);
      console.log(`   Prompt eval: ${data.timings.prompt_ms.toFixed(0)}ms (${data.timings.prompt_per_second.toFixed(1)} tok/s)`);
      console.log(`   Generation: ${data.timings.predicted_ms.toFixed(0)}ms (${data.timings.predicted_per_second.toFixed(1)} tok/s)`);
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

testLargeContext();
