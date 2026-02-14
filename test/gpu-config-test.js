#!/usr/bin/env node

/**
 * GPU Configuration Test
 * 
 * Verifies that GPU configuration is loaded and applied correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 GPU Configuration Test\n');

// Test 1: Check config.json has GPU settings
function testConfigHasGPUSettings() {
  const configPath = path.join(__dirname, '../config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  const checks = [];
  
  // Check llama GPU config
  if (config.llama?.gpu?.enabled !== undefined) {
    checks.push('✅ llama.gpu.enabled exists');
  } else {
    checks.push('❌ llama.gpu.enabled missing');
  }
  
  if (config.llama?.gpu?.layers !== undefined) {
    checks.push('✅ llama.gpu.layers exists');
  } else {
    checks.push('❌ llama.gpu.layers missing');
  }
  
  if (config.llama?.gpu?.device !== undefined) {
    checks.push('✅ llama.gpu.device exists');
  } else {
    checks.push('❌ llama.gpu.device missing');
  }
  
  // Check whisper GPU config
  if (config.whisper?.gpu?.enabled !== undefined) {
    checks.push('✅ whisper.gpu.enabled exists');
  } else {
    checks.push('❌ whisper.gpu.enabled missing');
  }
  
  if (config.whisper?.gpu?.device !== undefined) {
    checks.push('✅ whisper.gpu.device exists');
  } else {
    checks.push('❌ whisper.gpu.device missing');
  }
  
  console.log('📋 Config File Checks:');
  checks.forEach(check => console.log(`  ${check}`));
  
  return checks.every(c => c.startsWith('✅'));
}

// Test 2: Check .env/config.json has GPU settings
function testEnvConfigHasGPUSettings() {
  const configPath = path.join(__dirname, '../.env/config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  const checks = [];
  
  if (config.llama?.gpu?.enabled !== undefined) {
    checks.push('✅ llama.gpu.enabled exists');
  } else {
    checks.push('❌ llama.gpu.enabled missing');
  }
  
  if (config.whisper?.gpu?.enabled !== undefined) {
    checks.push('✅ whisper.gpu.enabled exists');
  } else {
    checks.push('❌ whisper.gpu.enabled missing');
  }
  
  console.log('\n📋 .env/config.json Checks:');
  checks.forEach(check => console.log(`  ${check}`));
  
  return checks.every(c => c.startsWith('✅'));
}

// Test 3: Check default values
function testDefaultValues() {
  const configPath = path.join(__dirname, '../config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  console.log('\n📊 Default GPU Configuration:');
  console.log(`  llama.gpu.enabled: ${config.llama?.gpu?.enabled}`);
  console.log(`  llama.gpu.layers: ${config.llama?.gpu?.layers}`);
  console.log(`  llama.gpu.device: ${config.llama?.gpu?.device}`);
  console.log(`  whisper.gpu.enabled: ${config.whisper?.gpu?.enabled}`);
  console.log(`  whisper.gpu.device: ${config.whisper?.gpu?.device}`);
  
  const allEnabled = config.llama?.gpu?.enabled === true && config.whisper?.gpu?.enabled === true;
  if (allEnabled) {
    console.log('\n✅ GPU enabled by default for all models');
  } else {
    console.log('\n⚠️  GPU not enabled by default');
  }
  
  return allEnabled;
}

// Run tests
const test1 = testConfigHasGPUSettings();
const test2 = testEnvConfigHasGPUSettings();
const test3 = testDefaultValues();

console.log('\n' + '='.repeat(50));
if (test1 && test2 && test3) {
  console.log('✅ All GPU configuration tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}
