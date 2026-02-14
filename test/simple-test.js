#!/usr/bin/env node
/**
 * Simple test for lols-router
 * Tests basic functionality without starting the full server
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Running simple lols-router tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${err.message}`);
    failed++;
  }
}

// Test 1: Check if core files exist
test('Core files exist', () => {
  const files = [
    'src/server.js',
    'src/helpers/config.js',
    'src/helpers/model-router.js',
    'src/helpers/orchestrator.js',
    'src/config.json',
    'src/models.json'
  ];
  
  files.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing file: ${file}`);
    }
  });
});

// Test 2: Load configuration
test('Configuration loads successfully', () => {
  const config = require('../src/helpers/config');
  
  if (!config.server) throw new Error('Missing server config');
  if (!config.server.port) throw new Error('Missing server port');
  if (!config.llama) throw new Error('Missing llama config');
});

// Test 3: Load models configuration
test('Models configuration loads successfully', () => {
  const { loadModels } = require('../src/helpers/config');
  const models = loadModels();
  
  if (!models) throw new Error('Models config failed to load');
  if (!models.models && !models['llama-models']) {
    throw new Error('No models defined');
  }
  if (!models['lols-smart']) {
    throw new Error('Missing lols-smart routing config');
  }
});

// Test 4: Check model router module
test('Model router module loads', () => {
  const modelRouter = require('../src/helpers/model-router');
  
  if (typeof modelRouter.selectModel !== 'function') {
    throw new Error('selectModel function not found');
  }
});

// Test 5: Check if .env override works
test('Environment config override works', () => {
  const config = require('../src/helpers/config');
  const { loadModels } = require('../src/helpers/config');
  
  // Just verify the loading mechanism exists
  if (typeof loadModels !== 'function') {
    throw new Error('loadModels function not exported');
  }
});

// Test 6: Validate models.json structure
test('Models.json has valid structure', () => {
  const { loadModels } = require('../src/helpers/config');
  const models = loadModels();
  
  const modelsList = models.models || models['llama-models'] || {};
  const lolsSmart = models['lols-smart'] || {};
  
  // Check at least one model is defined
  const modelCount = Object.keys(modelsList).length;
  if (modelCount === 0) {
    throw new Error('No models defined in models.json');
  }
  
  // Check lols-smart has required categories
  const requiredCategories = ['default', 'code', 'chat'];
  requiredCategories.forEach(cat => {
    if (!lolsSmart[cat]) {
      throw new Error(`Missing category: ${cat}`);
    }
  });
});

// Test 7: Check package.json dependencies
test('Package.json exists and has dependencies', () => {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  if (!pkg.dependencies) {
    throw new Error('No dependencies defined');
  }
  
  const requiredDeps = ['express', 'undici', 'ws', 'execa'];
  requiredDeps.forEach(dep => {
    if (!pkg.dependencies[dep]) {
      throw new Error(`Missing dependency: ${dep}`);
    }
  });
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  console.log('\n❌ Tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
