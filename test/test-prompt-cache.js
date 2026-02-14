#!/usr/bin/env node

// Test prompt caching - run the same request twice and compare times

async function testCache() {
  console.log('🧪 Testing prompt cache effectiveness...\n');

  const testMessage = {
    model: 'hermes-3-llama-3.1-8b',
    messages: [
      { 
        role: 'system', 
        content: 'You are a helpful assistant. '.repeat(500) // ~5k token system prompt
      },
      { role: 'user', content: 'What is 2+2?' }
    ],
    max_tokens: 50
  };

  // First request (cold cache)
  console.log('📤 Request 1 (cold cache)...');
  const start1 = Date.now();
  const res1 = await fetch('http://192.168.0.21:3000/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testMessage)
  });
  const data1 = await res1.json();
  const time1 = Date.now() - start1;
  
  console.log(`⏱️  Time: ${time1}ms`);
  console.log(`📊 Prompt tokens: ${data1.usage?.prompt_tokens || 'N/A'}`);
  if (data1.timings) {
    console.log(`   Prompt eval: ${data1.timings.prompt_ms.toFixed(0)}ms (${data1.timings.prompt_per_second.toFixed(0)} tok/s)`);
    console.log(`   Cache hits: ${data1.timings.cache_n || 0} tokens`);
  }

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Second request (warm cache - should be MUCH faster)
  console.log('\n📤 Request 2 (warm cache - same prompt)...');
  const start2 = Date.now();
  const res2 = await fetch('http://192.168.0.21:3000/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testMessage)
  });
  const data2 = await res2.json();
  const time2 = Date.now() - start2;
  
  console.log(`⏱️  Time: ${time2}ms`);
  console.log(`📊 Prompt tokens: ${data2.usage?.prompt_tokens || 'N/A'}`);
  if (data2.timings) {
    console.log(`   Prompt eval: ${data2.timings.prompt_ms.toFixed(0)}ms (${data2.timings.prompt_per_second.toFixed(0)} tok/s)`);
    console.log(`   Cache hits: ${data2.timings.cache_n || 0} tokens`);
  }

  // Compare
  const speedup = (time1 / time2).toFixed(2);
  const promptSpeedup = data1.timings && data2.timings 
    ? (data1.timings.prompt_ms / data2.timings.prompt_ms).toFixed(2)
    : 'N/A';

  console.log(`\n✅ Results:`);
  console.log(`   Total speedup: ${speedup}x faster`);
  console.log(`   Prompt speedup: ${promptSpeedup}x faster`);
  
  if (data2.timings?.cache_n > 0) {
    console.log(`   ✅ Prompt cache IS working! (${data2.timings.cache_n} cached tokens)`);
  } else {
    console.log(`   ⚠️  Prompt cache NOT working (0 cached tokens)`);
  }
}

testCache().catch(console.error);
