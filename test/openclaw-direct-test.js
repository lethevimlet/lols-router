#!/usr/bin/env node
/**
 * Test that mimics EXACTLY how OpenClaw calls lols-router
 * by checking what OpenClaw actually sends
 */

const SERVER_URL = 'http://192.168.0.21:3000';

// Listen mode - log what requests look like
async function interceptTest() {
  console.log('🔍 Testing with OpenClaw-like large context...\n');
  
  // Simulate OpenClaw's actual behavior with large context
  const massiveHistory = [];
  
  // OpenClaw can send 50+ messages in history
  for (let i = 0; i < 50; i++) {
    massiveHistory.push(
      { role: 'user', content: `This is user message ${i}. `.repeat(20) },
      { role: 'assistant', content: `This is assistant response ${i}. `.repeat(30) }
    );
  }
  
  massiveHistory.push({ role: 'user', content: 'hi' });
  
  const requestBody = {
    model: 'lols-smart',
    messages: massiveHistory,
    stream: false,
    max_tokens: 100
  };
  
  // Calculate approximate size
  const bodySize = JSON.stringify(requestBody).length;
  const estimatedTokens = Math.floor(bodySize / 4);
  
  console.log(`📦 Request size: ${(bodySize / 1024).toFixed(2)} KB`);
  console.log(`📊 Message count: ${massiveHistory.length}`);
  console.log(`🧮 Estimated tokens: ~${estimatedTokens}`);
  console.log(`⏱️  Starting request...\n`);
  
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS in ${duration}s`);
      console.log(`📝 Response: ${data.choices[0].message.content.substring(0, 100)}`);
    } else {
      console.log(`❌ HTTP ${response.status} in ${duration}s`);
      const error = await response.text();
      console.log(error.substring(0, 500));
    }
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`❌ Failed after ${elapsed}s: ${error.message}`);
  }
}

interceptTest();
