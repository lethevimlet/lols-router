#!/usr/bin/env node
/**
 * Test WebSocket log broadcasting
 * 
 * Usage: node test/ws-logs-test.js [SERVER_URL]
 * 
 * This script:
 * 1. Connects to the WebSocket server
 * 2. Makes a chat completion request
 * 3. Listens for log messages
 * 4. Verifies logs are being broadcast
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const SERVER_URL = process.argv[2] || process.env.SERVER_URL || 'http://192.168.0.21:3000';
const parsedUrl = new url.URL(SERVER_URL);
const WS_URL = `ws://${parsedUrl.hostname}:${parsedUrl.port || 3000}`;

let ws;
let logMessagesReceived = [];

// Connect to WebSocket
console.log('Connecting to WebSocket...');
ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected\n');
  
  // Make a test request after connection
  setTimeout(makeTestRequest, 500);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    
    if (msg.type === 'log') {
      console.log('📨 LOG MESSAGE RECEIVED:');
      console.log('  Source:', msg.source);
      console.log('  Message:', msg.message);
      console.log('  Timestamp:', new Date(msg.timestamp).toISOString());
      console.log('');
      logMessagesReceived.push(msg);
    } else if (msg.type === 'modelStatus') {
      console.log('📊 Model Status:', msg.model);
    } else if (msg.type === 'categoryStatus') {
      console.log('🏷️  Category:', msg.category);
    }
  } catch (err) {
    console.error('Error parsing WebSocket message:', err.message);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('WebSocket closed');
});

function makeTestRequest() {
  console.log('Making test request to /v1/chat/completions...\n');
  
  const postData = JSON.stringify({
    model: 'qwen2.5-1.5b-instruct',
    messages: [
      { role: 'user', content: 'Say hello in 3 words' }
    ],
    max_tokens: 10,
    stream: false
  });
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 3000,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = http.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('✅ Request completed (status:', res.statusCode, ')\n');
      
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(responseData);
          console.log('Response:', response.choices[0].message.content);
        } catch (err) {
          console.log('Response:', responseData.substring(0, 200));
        }
      } else {
        console.log('Error response:', responseData.substring(0, 500));
      }
      
      // Wait for WebSocket messages, then summarize
      setTimeout(summarizeResults, 3000);
    });
  });
  
  req.on('error', (err) => {
    console.error('❌ Request error:', err.message);
    setTimeout(summarizeResults, 1000);
  });
  
  req.write(postData);
  req.end();
}

function summarizeResults() {
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('Log messages received:', logMessagesReceived.length);
  
  if (logMessagesReceived.length > 0) {
    console.log('\n✅ SUCCESS: WebSocket log broadcasting is working!');
    console.log('\nSample logs:');
    logMessagesReceived.slice(0, 5).forEach((msg, i) => {
      console.log(`  ${i+1}. [${msg.source}] ${msg.message.substring(0, 60)}`);
    });
  } else {
    console.log('\n❌ FAILURE: No log messages received via WebSocket');
    console.log('\nPossible issues:');
    console.log('  1. Server logging is disabled');
    console.log('  2. broadcastLog function not being called');
    console.log('  3. WebSocket not properly connected');
  }
  
  ws.close();
  process.exit(logMessagesReceived.length > 0 ? 0 : 1);
}
