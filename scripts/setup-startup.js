#!/usr/bin/env node
/**
 * PM2 Startup Configuration Helper
 * Guides user through setting up PM2 auto-start on system boot
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 PM2 Auto-Start Setup Helper\n');

// Load remote config
function loadRemoteConfig() {
  const configPath = path.join(__dirname, '../.env/remote.json');
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: .env/remote.json not found');
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const config = loadRemoteConfig();
const { host, user } = config.ssh;

console.log('📋 To enable PM2 auto-start on boot, follow these steps:\n');
console.log('1️⃣  SSH into the remote server:');
console.log(`   ssh ${user}@${host}\n`);

console.log('2️⃣  Run PM2 startup command:');
console.log('   pm2 startup\n');

console.log('3️⃣  Copy and run the command it outputs (with sudo)\n');

console.log('4️⃣  Save the current PM2 process list:');
console.log('   pm2 save\n');

console.log('5️⃣  Verify it\'s working:');
console.log('   systemctl --user status pm2-ai.service');
console.log('   (or check without --user depending on setup)\n');

console.log('📚 For detailed instructions, see: docs/PM2-STARTUP.md\n');

console.log('💾 Attempting to save PM2 process list remotely...\n');

try {
  execSync('npm run pm2:save', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('\n✅ PM2 process list saved remotely');
  console.log('⚠️  You still need to run the startup commands manually (requires sudo)');
} catch (err) {
  console.error('\n❌ Failed to save PM2 process list');
  console.error('Try running: npm run pm2:save');
}

console.log('\n💡 Quick setup: SSH in and run these 3 commands:');
console.log('   1. pm2 startup');
console.log('   2. [copy/paste the sudo command from output]');
console.log('   3. pm2 save');
