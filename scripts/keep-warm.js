#!/usr/bin/env node
/**
 * Keep lols-router models warm by periodically sending keepalive requests
 * This prevents cold starts and improves response times for OpenClaw
 */

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS) || 5 * 60 * 1000; // 5 minutes default

const MODELS_TO_WARM = [
  'qwen2.5.1-coder-7b-instruct',  // Primary coding model
  'lols-smart'                     // Router-based model
];

async function pingModel(model) {
  try {
    const response = await fetch(`${SERVER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false
      }),
      signal: AbortSignal.timeout(30000)
    });
    
    if (response.ok) {
      console.log(`✓ ${model} - warm`);
      return true;
    } else {
      console.log(`✗ ${model} - HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ ${model} - ${error.message}`);
    return false;
  }
}

async function warmupCycle() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Running warmup cycle...`);
  
  for (const model of MODELS_TO_WARM) {
    await pingModel(model);
  }
}

async function main() {
  console.log('🔥 lols-router Keep-Warm Service');
  console.log(`📡 Server: ${SERVER_URL}`);
  console.log(`⏱️  Interval: ${INTERVAL_MS / 1000}s`);
  console.log(`🎯 Models: ${MODELS_TO_WARM.join(', ')}\n`);
  
  // Initial warmup
  await warmupCycle();
  
  // Periodic warmup
  setInterval(warmupCycle, INTERVAL_MS);
  
  console.log(`\n✅ Keep-warm service running. Press Ctrl+C to stop.`);
}

main().catch(error => {
  console.error('❌ Keep-warm service failed:', error);
  process.exit(1);
});
