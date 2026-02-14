#!/usr/bin/env node
/**
 * Remote SSH Helper for lols-router
 * 
 * Utilities for deploying and testing lols-router on remote machines
 * Uses configuration from .env/remote.json
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Load remote configuration
function loadRemoteConfig() {
  const configPath = path.join(__dirname, '../.env/remote.json');
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: .env/remote.json not found');
    console.error('Create it by editing .env/remote.json');
    process.exit(1);
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config;
  } catch (err) {
    console.error('❌ Error parsing remote.json:', err.message);
    process.exit(1);
  }
}

// Expand tilde in paths
function expandPath(p) {
  if (p.startsWith('~/')) {
    return p.replace('~', process.env.HOME || '~');
  }
  return p;
}

// Check if PM2 should be used
function shouldUsePM2(config) {
  // Check config setting first
  if (config.deployment && config.deployment.processManager) {
    return config.deployment.processManager === 'pm2';
  }
  
  // Auto-detect: check if ecosystem.config.js exists
  try {
    const ecosystemPath = path.join(__dirname, '../ecosystem.config.js');
    return fs.existsSync(ecosystemPath);
  } catch (err) {
    return false;
  }
}

// Get PM2 app name from config or default
function getPM2AppName(config) {
  return (config.deployment && config.deployment.pm2AppName) || 'lols-router';
}

// Build SSH command prefix
function buildSSHCommand(config, command) {
  const { host, port, user, authMethod, privateKeyPath, password } = config.ssh;
  
  let sshCmd = '';
  
  // Use sshpass for password authentication
  if (authMethod === 'password' && password) {
    sshCmd = `sshpass -p "${password}" `;
  }
  
  sshCmd += 'ssh -o StrictHostKeyChecking=no';
  
  if (authMethod === 'key') {
    const keyPath = expandPath(privateKeyPath);
    sshCmd += ` -i "${keyPath}"`;
  }
  
  if (port && port !== 22) {
    sshCmd += ` -p ${port}`;
  }
  
  sshCmd += ` ${user}@${host}`;
  
  if (command) {
    // Wrap command to source nvm if it exists (for node commands)
    const wrappedCommand = `[ -f ~/.nvm/nvm.sh ] && source ~/.nvm/nvm.sh; ${command}`;
    sshCmd += ` "${wrappedCommand}"`;
  }
  
  return sshCmd;
}

// Check if rsync is installed, install if not
function ensureRsync() {
  try {
    execSync('which rsync', { stdio: 'ignore' });
    return true;
  } catch (err) {
    console.log('⚠️  rsync not found. Installing...');
    try {
      // Try to install rsync
      execSync('sudo apt-get update && sudo apt-get install -y rsync', { 
        stdio: 'inherit' 
      });
      console.log('✅ rsync installed successfully');
      return true;
    } catch (installErr) {
      console.error('❌ Failed to install rsync automatically');
      console.error('\nPlease install rsync manually:');
      console.error('  Ubuntu/Debian: sudo apt-get install rsync');
      console.error('  macOS: brew install rsync');
      console.error('  Arch: sudo pacman -S rsync');
      return false;
    }
  }
}

// Build rsync command with SSH options
function buildRsyncCommand(config) {
  const { host, port, user, authMethod, privateKeyPath, password } = config.ssh;
  
  let sshOpts = '-o StrictHostKeyChecking=no';
  
  if (authMethod === 'key') {
    const keyPath = expandPath(privateKeyPath);
    sshOpts += ` -i ${keyPath}`;
  }
  
  if (port && port !== 22) {
    sshOpts += ` -p ${port}`;
  }
  
  let rsyncPrefix = '';
  if (authMethod === 'password' && password) {
    rsyncPrefix = `sshpass -p "${password}" `;
  }
  
  return {
    rsyncPrefix,
    sshOpts: sshOpts.trim(),
    target: `${user}@${host}`
  };
}

// Commands
const commands = {
  // Test SSH connection
  test: (config) => {
    console.log('🔍 Testing SSH connection...');
    const cmd = buildSSHCommand(config, 'echo "✅ SSH connection successful!" && uname -a');
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      console.error('❌ SSH connection failed');
      process.exit(1);
    }
  },
  
  // Sync/deploy project files to remote
  sync: (config) => {
    console.log('📦 Syncing files to remote server...');
    
    // Ensure rsync is installed
    if (!ensureRsync()) {
      process.exit(1);
    }
    
    const { projectPath } = config.remote;
    const { excludePatterns } = config.deployment;
    const { rsyncPrefix, sshOpts, target } = buildRsyncCommand(config);
    
    // Build rsync command
    let rsyncCmd = rsyncPrefix || '';
    rsyncCmd += 'rsync -avz --progress --delete';
    
    if (sshOpts) {
      rsyncCmd += ` -e "ssh ${sshOpts}"`;
    }
    
    // Add exclude patterns
    excludePatterns.forEach(pattern => {
      rsyncCmd += ` --exclude='${pattern}'`;
    });
    
    rsyncCmd += ` ./ ${target}:${projectPath}/`;
    
    console.log(`\n📤 Syncing to ${target}:${projectPath}/\n`);
    
    try {
      execSync(rsyncCmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('\n✅ Sync complete!');
    } catch (err) {
      console.error('\n❌ Sync failed');
      if (err.message && err.message.includes('rsync: command not found')) {
        console.error('\n💡 Tip: rsync not found on remote. Run:');
        console.error('  node scripts/remote-helper.js setup');
      }
      process.exit(1);
    }
  },
  
  // Install npm dependencies on remote
  install: (config) => {
    console.log('📦 Installing npm dependencies on remote...');
    const { projectPath, npmCommand } = config.remote;
    
    // Use 'yes' to auto-confirm npm prompts
    const cmd = buildSSHCommand(
      config, 
      `cd ${projectPath} && yes | ${npmCommand} install || ${npmCommand} install`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('✅ Dependencies installed');
    } catch (err) {
      console.error('❌ Installation failed');
      process.exit(1);
    }
  },
  
  // Start server on remote (background)
  start: (config) => {
    console.log('🚀 Starting server on remote...');
    const { projectPath } = config.remote;
    const { startCommand, testPort } = config.testing;
    const usePM2 = shouldUsePM2(config);
    const pm2AppName = getPM2AppName(config);
    
    let startCmd;
    if (usePM2) {
      console.log(`ℹ️  Using PM2 (app: ${pm2AppName})`);
      // Check if app is already running, restart if so, start if not
      startCmd = `cd ${projectPath} && pm2 describe ${pm2AppName} > /dev/null 2>&1 && pm2 restart ${pm2AppName} || pm2 start ecosystem.config.js`;
    } else {
      startCmd = `cd ${projectPath} && nohup ${startCommand} > server.log 2>&1 & echo "Server started with PID: $!" && sleep 1 && lsof -i :${testPort} || echo "Waiting for server..."`;
    }
    
    const cmd = buildSSHCommand(config, startCmd);
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('✅ Server start command sent');
      console.log(`\nℹ️  Check status with: node scripts/remote-helper.js status`);
      console.log(`ℹ️  View logs with: node scripts/remote-helper.js logs`);
    } catch (err) {
      console.error('❌ Failed to start server');
      process.exit(1);
    }
  },
  
  // Stop server gracefully
  stop: (config) => {
    console.log('🛑 Stopping server on remote...');
    const { projectPath } = config.remote;
    const usePM2 = shouldUsePM2(config);
    const pm2AppName = getPM2AppName(config);
    
    let stopCmd;
    if (usePM2) {
      console.log(`ℹ️  Using PM2 (app: ${pm2AppName})`);
      stopCmd = `cd ${projectPath} && pm2 stop ${pm2AppName} 2>/dev/null && echo "PM2 app stopped" || echo "App not running"`;
    } else {
      stopCmd = `pkill -SIGTERM -f 'node src/server' && echo "Stop signal sent" || echo "No server process found"`;
    }
    
    const cmd = buildSSHCommand(config, stopCmd);
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('✅ Stop command sent');
    } catch (err) {
      // pkill exits with 1 if no process found
      console.log('ℹ️  Stop command completed');
    }
  },
  
  // Kill server forcefully
  kill: (config) => {
    console.log('💀 Killing server on remote (forceful)...');
    const { testPort } = config.testing;
    const usePM2 = shouldUsePM2(config);
    const pm2AppName = getPM2AppName(config);
    
    let killCmd;
    if (usePM2) {
      console.log(`ℹ️  Using PM2 (app: ${pm2AppName})`);
      killCmd = `pm2 delete ${pm2AppName} 2>/dev/null && echo "PM2 app deleted" || echo "App not found"; fuser -k ${testPort}/tcp 2>/dev/null && echo "Port ${testPort} freed" || true`;
    } else {
      killCmd = `pkill -9 -f 'node src/server' && echo "Server killed" || echo "No server process found"; fuser -k ${testPort}/tcp 2>/dev/null && echo "Port ${testPort} freed" || true`;
    }
    
    const cmd = buildSSHCommand(config, killCmd);
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('✅ Kill command sent');
    } catch (err) {
      console.log('ℹ️  Kill command completed');
    }
  },
  
  // Restart server (stop + start)
  restart: (config) => {
    console.log('🔄 Restarting server on remote...\n');
    const { projectPath } = config.remote;
    const usePM2 = shouldUsePM2(config);
    const pm2AppName = getPM2AppName(config);
    
    if (usePM2) {
      // PM2 has built-in restart command - much cleaner
      console.log(`ℹ️  Using PM2 restart (app: ${pm2AppName})`);
      const cmd = buildSSHCommand(config, `cd ${projectPath} && pm2 restart ${pm2AppName}`);
      
      try {
        execSync(cmd, { stdio: 'inherit' });
        console.log('\n✅ PM2 restart complete');
      } catch (err) {
        console.error('\n❌ PM2 restart failed');
        process.exit(1);
      }
    } else {
      // Original stop + wait + start sequence
      console.log('Step 1: Stopping existing server...');
      commands.stop(config);
      
      console.log('\nStep 2: Waiting 2 seconds...');
      execSync('sleep 2', { stdio: 'inherit' });
      
      console.log('\nStep 3: Starting server...');
      commands.start(config);
      
      console.log('\n✅ Restart sequence complete');
    }
  },
  
  // View server logs (streaming)
  logs: (config) => {
    console.log('📋 Viewing server logs (Ctrl+C to exit)...\n');
    const { projectPath } = config.remote;
    const usePM2 = shouldUsePM2(config);
    const pm2AppName = getPM2AppName(config);
    
    let logsCmd;
    if (usePM2) {
      console.log(`ℹ️  Using PM2 logs (app: ${pm2AppName})\n`);
      logsCmd = `pm2 logs ${pm2AppName} --lines 100`;
    } else {
      logsCmd = `tail -f ${projectPath}/server.log`;
    }
    
    const cmd = buildSSHCommand(config, logsCmd);
    
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      // User interrupted with Ctrl+C
      console.log('\n✅ Log viewing stopped');
    }
  },
  
  // View last N lines of logs
  logs_tail: (config, args) => {
    const lines = args[0] || '50';
    console.log(`📋 Last ${lines} lines of server logs:\n`);
    const { projectPath } = config.remote;
    const usePM2 = shouldUsePM2(config);
    const pm2AppName = getPM2AppName(config);
    
    let logsCmd;
    if (usePM2) {
      logsCmd = `pm2 logs ${pm2AppName} --lines ${lines} --nostream 2>/dev/null || echo "No logs found"`;
    } else {
      logsCmd = `tail -n ${lines} ${projectPath}/server.log 2>/dev/null || echo "No logs found"`;
    }
    
    const cmd = buildSSHCommand(config, logsCmd);
    
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      console.error('❌ Failed to read logs');
    }
  },
  
  // Check server status
  status: (config) => {
    console.log('🔍 Checking server status...\n');
    const { projectPath } = config.remote;
    const { testPort } = config.testing;
    const usePM2 = shouldUsePM2(config);
    const pm2AppName = getPM2AppName(config);
    
    let statusCmd;
    if (usePM2) {
      console.log(`ℹ️  Using PM2 status (app: ${pm2AppName})\n`);
      statusCmd = `echo "=== PM2 Status ===" && pm2 list && echo "" && echo "=== Port Status ===" && lsof -i :${testPort} || echo "Port ${testPort} not in use"`;
    } else {
      statusCmd = `echo "=== Process Status ===" && ps aux | grep 'node src/server' | grep -v grep && echo "" && echo "=== Port Status ===" && lsof -i :${testPort} || echo "Server not running on port ${testPort}"`;
    }
    
    const cmd = buildSSHCommand(config, statusCmd);
    
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      // Ignore errors
    }
  },
  
  // Setup remote environment (install rsync, etc.)
  setup: (config) => {
    console.log('🔧 Setting up remote environment...\n');
    
    console.log('Step 1: Checking rsync on remote...');
    const checkCmd = buildSSHCommand(config, 'which rsync');
    try {
      execSync(checkCmd, { stdio: 'ignore' });
      console.log('✅ rsync already installed on remote\n');
    } catch (err) {
      console.log('⚠️  rsync not found on remote, installing...');
      
      // Use -S option for sudo to read password from stdin
      const { password, authMethod } = config.ssh;
      let installCmd;
      
      if (authMethod === 'password' && password) {
        // Echo password to sudo -S (reads from stdin)
        installCmd = buildSSHCommand(
          config,
          `echo "${password}" | sudo -S apt-get update -qq && echo "${password}" | sudo -S apt-get install -y rsync`
        );
      } else {
        // Fallback to regular sudo (will prompt)
        installCmd = buildSSHCommand(
          config,
          'sudo apt-get update -qq && sudo apt-get install -y rsync'
        );
      }
      
      try {
        execSync(installCmd, { stdio: 'inherit' });
        console.log('✅ rsync installed on remote\n');
      } catch (installErr) {
        console.error('❌ Failed to install rsync on remote');
        console.error('Please install it manually:');
        console.error('  ssh user@remote "sudo apt-get install rsync"');
        process.exit(1);
      }
    }
    
    console.log('✅ Remote environment ready!');
  },
  
  // Execute custom command on remote
  exec: (config, args) => {
    const command = args.join(' ');
    if (!command) {
      console.error('❌ No command specified');
      console.error('Usage: node scripts/remote-helper.js exec "your command here"');
      process.exit(1);
    }
    
    console.log(`🔧 Executing: ${command}\n`);
    const cmd = buildSSHCommand(config, command);
    
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      process.exit(1);
    }
  },
  
  // Full deploy workflow
  deploy: (config) => {
    console.log('🚀 Running full deployment workflow...\n');
    
    console.log('=== Step 1: Testing SSH connection ===');
    commands.test(config);
    console.log('');
    
    console.log('=== Step 2: Syncing files ===');
    commands.sync(config);
    console.log('');
    
    if (config.testing.autoInstallDeps) {
      console.log('=== Step 3: Installing dependencies ===');
      commands.install(config);
      console.log('');
    }
    
    if (config.testing.autoStart) {
      console.log('=== Step 4: Restarting server ===');
      commands.restart(config);
      console.log('');
    }
    
    console.log('✅ Full deployment complete!');
    console.log('\nNext steps:');
    console.log('  - Check status: node scripts/remote-helper.js status');
    console.log('  - View logs: node scripts/remote-helper.js logs');
  },
  
  // Run integration tests against remote
  'test-integration': (config) => {
    console.log('🧪 Running integration tests against remote server...\n');
    
    const { healthCheckEndpoint } = config.testing;
    const serverUrl = healthCheckEndpoint.replace(/\/v1\/models$/, '');
    
    console.log(`Target: ${serverUrl}\n`);
    
    const cmd = `node test/integration-test.js ${serverUrl}`;
    
    try {
      execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('\n✅ Integration tests completed!');
    } catch (err) {
      console.error('\n❌ Integration tests failed');
      process.exit(1);
    }
  },
  
  // Full test workflow: start server, run tests, stop server
  'test-remote': (config) => {
    console.log('🚀 Running full test workflow on remote...\n');
    
    // Step 1: Ensure server is stopped
    console.log('Step 1: Ensuring server is stopped...');
    try {
      commands.stop(config);
      execSync('sleep 2'); // Wait for cleanup
    } catch (err) {
      // Ignore errors - server might not be running
    }
    console.log('');
    
    // Step 2: Start server
    console.log('Step 2: Starting server...');
    try {
      commands.start(config);
    } catch (err) {
      console.error('❌ Failed to start server');
      process.exit(1);
    }
    console.log('');
    
    // Step 3: Wait for server to be ready
    console.log('Step 3: Waiting for server to be ready...');
    const { healthCheckEndpoint } = config.testing;
    const maxRetries = 15;
    let ready = false;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        execSync(`curl -s -f ${healthCheckEndpoint} > /dev/null 2>&1`, { timeout: 5000 });
        ready = true;
        console.log('✅ Server is ready\n');
        break;
      } catch (err) {
        if (i < maxRetries - 1) {
          process.stdout.write('.');
          execSync('sleep 3');
        }
      }
    }
    
    if (!ready) {
      console.error('\n❌ Server failed to start within timeout');
      console.log('\nTrying to stop server...');
      try {
        commands.stop(config);
      } catch (err) {
        // Ignore
      }
      process.exit(1);
    }
    
    // Step 4: Run integration tests
    console.log('Step 4: Running integration tests...\n');
    const serverUrl = healthCheckEndpoint.replace(/\/v1\/models$/, '');
    const testCmd = `node test/integration-test.js ${serverUrl}`;
    
    let testsPassed = false;
    try {
      execSync(testCmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      testsPassed = true;
    } catch (err) {
      console.error('\n❌ Tests failed');
    }
    
    // Step 5: Stop server
    console.log('\nStep 5: Stopping server...');
    try {
      commands.stop(config);
      console.log('✅ Server stopped\n');
    } catch (err) {
      console.warn('⚠️  Failed to stop server cleanly');
    }
    
    // Summary
    if (testsPassed) {
      console.log('✅ Full test workflow completed successfully!');
    } else {
      console.log('❌ Test workflow completed with failures');
      process.exit(1);
    }
  },
  
  // Run 14B model tests (remote)
  'test-14b': (config) => {
    console.log('🧪 Running 14B model tests on remote server...\n');
    const { healthCheckEndpoint } = config.testing;
    const serverUrl = healthCheckEndpoint.replace(/\/v1\/models$/, '');
    
    const cmd = `node test/14b-remote-test.js ${serverUrl}`;
    
    try {
      execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('\n✅ 14B tests completed!');
    } catch (err) {
      console.error('\n❌ 14B tests failed');
      process.exit(1);
    }
  },
  
  // Run WebSocket logs test (remote)
  'test-ws': (config) => {
    console.log('🧪 Running WebSocket logs test on remote server...\n');
    const { healthCheckEndpoint } = config.testing;
    const serverUrl = healthCheckEndpoint.replace(/\/v1\/models$/, '');
    
    const cmd = `node test/ws-logs-test.js ${serverUrl}`;
    
    try {
      execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('\n✅ WebSocket test completed!');
    } catch (err) {
      console.error('\n❌ WebSocket test failed');
      process.exit(1);
    }
  },
  
  // Run all specific tests
  'test-all': (config) => {
    console.log('🚀 Running all tests on remote server...\n');
    
    const tests = [
      { name: '14B Model Tests', cmd: 'test-14b' },
      { name: 'WebSocket Tests', cmd: 'test-ws' }
    ];
    
    const results = [];
    
    for (const test of tests) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Running: ${test.name}`);
      console.log('='.repeat(60) + '\n');
      
      try {
        commands[test.cmd](config);
        results.push({ name: test.name, passed: true });
      } catch (err) {
        results.push({ name: test.name, passed: false });
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    
    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
    });
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    console.log(`\nTotal: ${passed}/${total} passed`);
    
    if (passed === total) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    }
  },
  
  // PM2 Commands
  'pm2-install': (config) => {
    console.log('📦 Installing PM2 globally on remote...\n');
    
    const cmd = buildSSHCommand(
      config,
      'npm list -g pm2 || npm install -g pm2'
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('\n✅ PM2 installed successfully');
    } catch (err) {
      console.error('\n❌ Failed to install PM2');
      process.exit(1);
    }
  },
  
  'pm2-start': (config) => {
    console.log('🚀 Starting lols-router with PM2...\n');
    const { projectPath } = config.remote;
    
    const cmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 start ecosystem.config.js`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('\n✅ Server started with PM2');
      console.log('\nℹ️  Check status: node scripts/remote-helper.js pm2-status');
      console.log('ℹ️  View logs: node scripts/remote-helper.js pm2-logs');
    } catch (err) {
      console.error('\n❌ Failed to start with PM2');
      process.exit(1);
    }
  },
  
  'pm2-stop': (config) => {
    console.log('🛑 Stopping lols-router via PM2...\n');
    const { projectPath } = config.remote;
    
    const cmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 stop lols-router`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('\n✅ Server stopped');
    } catch (err) {
      console.log('\nℹ️  Stop command completed');
    }
  },
  
  'pm2-restart': (config) => {
    console.log('🔄 Restarting lols-router via PM2...\n');
    const { projectPath } = config.remote;
    
    const cmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 restart lols-router`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('\n✅ Server restarted');
    } catch (err) {
      console.error('\n❌ Failed to restart');
      process.exit(1);
    }
  },
  
  'pm2-delete': (config) => {
    console.log('💀 Deleting lols-router from PM2...\n');
    const { projectPath } = config.remote;
    
    const cmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 delete lols-router`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('\n✅ Process deleted from PM2');
    } catch (err) {
      console.log('\nℹ️  Delete command completed');
    }
  },
  
  'pm2-status': (config) => {
    console.log('📊 PM2 process status...\n');
    const { projectPath } = config.remote;
    
    const cmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 list`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      console.error('\n❌ Failed to get PM2 status');
    }
  },
  
  'pm2-logs': (config) => {
    console.log('📋 Viewing PM2 logs (Ctrl+C to exit)...\n');
    const { projectPath } = config.remote;
    
    const cmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 logs lols-router --lines 50`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      // User interrupted with Ctrl+C
    }
  },
  
  'pm2-monit': (config) => {
    console.log('📊 Opening PM2 monitor (Ctrl+C to exit)...\n');
    const { projectPath } = config.remote;
    
    const cmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 monit`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
      // User interrupted with Ctrl+C
    }
  },
  
  'pm2-startup': (config) => {
    console.log('⚡ Configuring PM2 to start on boot...\n');
    
    // Get startup command
    console.log('Getting PM2 startup command...');
    const { projectPath } = config.remote;
    const startupCheckCmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 startup 2>&1`
    );
    
    try {
      const output = execSync(startupCheckCmd, { encoding: 'utf8' });
      console.log(output);
      
      // Extract the sudo command
      const sudoMatch = output.match(/sudo env .+$/m);
      if (sudoMatch) {
        const sudoCmd = sudoMatch[0];
        console.log('\n⚠️  This command requires sudo access.');
        console.log('Please run this command on the remote server:\n');
        console.log(`  ${sudoCmd}\n`);
        console.log('Then run: node scripts/remote-helper.js pm2-save');
      } else {
        console.log('\n⚠️  PM2 startup requires manual configuration with sudo.');
        console.log('SSH to the remote server and run: pm2 startup');
      }
    } catch (err) {
      console.error('\n❌ Failed to get startup command');
      console.log('Please SSH to the remote server and run: pm2 startup');
      process.exit(1);
    }
  },
  
  'pm2-save': (config) => {
    console.log('💾 Saving PM2 process list...\n');
    const { projectPath } = config.remote;
    
    const cmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 save`
    );
    
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log('\n✅ PM2 process list saved');
    } catch (err) {
      console.error('\n❌ Failed to save PM2 process list');
      process.exit(1);
    }
  },
  
  // Full PM2 setup workflow
  'pm2-setup': (config) => {
    console.log('🚀 Running full PM2 setup workflow...\n');
    
    console.log('=== Step 1: Installing PM2 ===');
    commands['pm2-install'](config);
    console.log('');
    
    console.log('=== Step 2: Stopping old processes ===');
    try {
      commands.kill(config);
    } catch (err) {
      // Ignore errors
    }
    console.log('');
    
    console.log('=== Step 3: Starting with PM2 ===');
    commands['pm2-start'](config);
    console.log('');
    
    console.log('=== Step 4: Saving PM2 process list ===');
    try {
      commands['pm2-save'](config);
    } catch (err) {
      console.warn('⚠️  Could not save PM2 process list');
    }
    console.log('');
    
    console.log('=== Step 5: Configuring startup (requires sudo) ===');
    console.log('⚡ To enable auto-start on boot, run this command on the remote server:\n');
    
    // Get the startup command from PM2
    const { projectPath } = config.remote;
    const startupCheckCmd = buildSSHCommand(
      config,
      `cd ${projectPath} && pm2 startup 2>&1 | grep "sudo env"`
    );
    
    try {
      const startupCmd = execSync(startupCheckCmd, { encoding: 'utf8' }).trim();
      if (startupCmd) {
        console.log(`${startupCmd}\n`);
        console.log('Then run: node scripts/remote-helper.js pm2-save\n');
      } else {
        console.log('Run on remote: pm2 startup');
        console.log('Then run the sudo command it provides');
        console.log('Then run: node scripts/remote-helper.js pm2-save\n');
      }
    } catch (err) {
      console.log('Run on remote: pm2 startup');
      console.log('Then run the sudo command it provides');
      console.log('Then run: node scripts/remote-helper.js pm2-save\n');
    }
    
    console.log('✅ PM2 setup complete!');
    console.log('\nNext steps:');
    console.log('  - Check status: node scripts/remote-helper.js pm2-status');
    console.log('  - View logs: node scripts/remote-helper.js pm2-logs');
    console.log('  - Monitor: node scripts/remote-helper.js pm2-monit');
    console.log('\n💡 The startup script is optional. PM2 will restart the app if it crashes,');
    console.log('   but won\'t auto-start on system reboot without the startup script.');
  },
  
  // Show help
  help: () => {
    console.log(`
📡 Remote SSH Helper for lols-router

Usage: node scripts/remote-helper.js <command> [args]

Commands (PM2-aware - auto-detects ecosystem.config.js):
  test               Test SSH connection
  setup              Setup remote environment (install rsync, etc.)
  sync               Sync project files to remote (rsync)
  install            Install npm dependencies on remote
  start              Start server (PM2 or direct node)
  stop               Stop server gracefully (PM2 stop or SIGTERM)
  kill               Kill server forcefully (PM2 delete or SIGKILL)
  restart            Restart server (PM2 restart or stop+start)
  status             Check server status (PM2 list or process status)
  logs               View server logs (PM2 logs or tail -f)
  logs-tail [N]      Show last N lines of logs (default: 50)
  exec "command"     Execute custom command on remote
  deploy             Full deployment workflow (sync + install + restart)
  test-integration   Run integration tests against remote server
  test-remote        Full test workflow (start + test + stop)
  test-14b           Run 14B model tests against remote server
  test-ws            Run WebSocket logs test against remote server
  test-all           Run all specific tests against remote server
  
PM2-Specific Commands:
  pm2-install        Install PM2 globally on remote
  pm2-setup          Full PM2 setup (install + start + configure boot)
  pm2-start          Start server with PM2
  pm2-stop           Stop PM2 process
  pm2-restart        Restart PM2 process
  pm2-delete         Delete process from PM2
  pm2-status         Show PM2 process status
  pm2-logs           View PM2 logs (streaming)
  pm2-monit          Open PM2 monitor dashboard
  pm2-startup        Configure PM2 to start on boot
  pm2-save           Save current PM2 process list
  
  help               Show this help message

Configuration (.env/remote.json):
  {
    "deployment": {
      "processManager": "pm2",      // "pm2" or "none" (default: auto-detect)
      "pm2AppName": "lols-router"   // PM2 app name (default: "lols-router")
    }
  }
  
  Auto-detection: Commands check for ecosystem.config.js to use PM2 automatically

Examples:
  node scripts/remote-helper.js test
  node scripts/remote-helper.js setup
  node scripts/remote-helper.js deploy
  node scripts/remote-helper.js sync
  node scripts/remote-helper.js install
  node scripts/remote-helper.js restart
  node scripts/remote-helper.js status
  node scripts/remote-helper.js logs
  node scripts/remote-helper.js logs-tail 100
  node scripts/remote-helper.js exec "cd ~/lols-router && pwd"
  node scripts/remote-helper.js exec "curl http://localhost:3000/v1/models"
  node scripts/remote-helper.js test-integration
  node scripts/remote-helper.js test-remote
  node scripts/remote-helper.js test-14b
  node scripts/remote-helper.js test-ws
  node scripts/remote-helper.js test-all
  
PM2 Examples:
  node scripts/remote-helper.js pm2-setup
  node scripts/remote-helper.js pm2-status
  node scripts/remote-helper.js pm2-logs
  node scripts/remote-helper.js pm2-restart
  node scripts/remote-helper.js pm2-monit

Workflow:
  1. Initial setup:     test → setup → deploy
  2. After code change: sync → restart
  3. Testing:           test-remote (full workflow) OR test-all (specific tests)
  4. Monitor:           status → logs
  
PM2 Workflow:
  1. First time:        pm2-setup (installs PM2, starts server, enables boot)
  2. After code change: sync → pm2-restart
  3. Monitor:           pm2-status → pm2-logs OR pm2-monit
    `);
  }
};

// Main
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    commands.help();
    return;
  }
  
  // Map command aliases
  const commandMap = {
    'logs-tail': 'logs_tail'
  };
  
  const actualCommand = commandMap[command] || command;
  
  if (!commands[actualCommand]) {
    console.error(`❌ Unknown command: ${command}`);
    console.error('Run with --help to see available commands');
    process.exit(1);
  }
  
  const config = loadRemoteConfig();
  
  // Commands that take additional arguments
  if (actualCommand === 'exec' || actualCommand === 'logs_tail') {
    commands[actualCommand](config, args.slice(1));
  } else {
    commands[actualCommand](config);
  }
}

main();
