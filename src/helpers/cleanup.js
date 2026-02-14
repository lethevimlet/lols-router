const { execaCommand } = require("execa");
const fs = require("fs");
const path = require("path");
const { createLogger } = require("./logger");
const { loadModels } = require("./config");

const log = createLogger("cleanup");

/**
 * Kill process on a specific port
 * This is actually NUCLEAR - kills ALL llama-server/whisper-server processes except router
 */
async function killPort(port) {
  let killedAny = false;
  const killedPids = new Set();
  
  try {
    // Method 1: Kill by port using lsof
    try {
      const { stdout } = await execaCommand(`lsof -ti:${port}`, {
        reject: false,
        timeout: 3000
      });
      
      if (stdout.trim()) {
        const pids = stdout.trim().split('\n').filter(p => p.trim());
        log.log(`Found ${pids.length} process(es) on port ${port} (lsof)`);
        
        for (const pid of pids) {
          if (!killedPids.has(pid)) {
            try {
              await execaCommand(`kill -9 ${pid.trim()}`);
              log.success(`Killed process ${pid} on port ${port}`);
              killedPids.add(pid);
              killedAny = true;
            } catch (err) {
              log.warn(`Failed to kill process ${pid}:`, err.message);
            }
          }
        }
      }
    } catch (err) {
      log.debug(`Method 1 (lsof) check failed:`, err.message);
    }
    
    // Method 2: NUCLEAR - Find and kill ALL llama-server and whisper-server processes
    // Exclude only the router (port 3001)
    try {
      const { stdout: psOutput } = await execaCommand(
        `ps aux | grep -E 'llama-server|whisper-server' | grep -v grep`,
        { reject: false, timeout: 3000, shell: true }
      );
      
      if (psOutput.trim()) {
        const lines = psOutput.trim().split('\n');
        log.log(`Scanning ${lines.length} llama/whisper process(es) total`);
        
        for (const line of lines) {
          // Skip if it's the router (port 3001)
          if (line.includes('--port 3001') || line.includes(':3001')) {
            log.debug('Skipping router process on port 3001');
            continue;
          }
          
          const parts = line.trim().split(/\s+/);
          if (parts.length > 1) {
            const pid = parts[1];
            if (!killedPids.has(pid)) {
              try {
                await execaCommand(`kill -9 ${pid}`);
                log.success(`Killed llama/whisper process ${pid}`);
                killedPids.add(pid);
                killedAny = true;
              } catch (err) {
                log.warn(`Failed to kill process ${pid}:`, err.message);
              }
            }
          }
        }
      }
    } catch (err) {
      log.debug(`Method 2 (process scan) failed:`, err.message);
    }
    
    // Method 3: Use pkill as final backup
    try {
      // Kill all llama-server processes except those with :3001
      const { stdout: pkillLlama } = await execaCommand(
        `pkill -9 -f 'llama-server' || true`,
        { reject: false, timeout: 2000, shell: true }
      );
      
      const { stdout: pkillWhisper } = await execaCommand(
        `pkill -9 -f 'whisper-server' || true`,
        { reject: false, timeout: 2000, shell: true }
      );
      
      if (pkillLlama || pkillWhisper) {
        log.log('Executed pkill for remaining processes');
        killedAny = true;
      }
    } catch (err) {
      log.debug(`Method 3 (pkill) failed:`, err.message);
    }
    
    // Wait for processes to die
    if (killedAny) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      log.success(`Cleanup complete - killed ${killedPids.size} process(es)`);
    } else {
      log.info(`No processes found to kill`);
    }
    
    return killedAny;
    
  } catch (err) {
    log.error(`Error during cleanup:`, err.message);
    return killedAny;
  }
}

/**
 * Clean up all model ports from models.json
 */
async function cleanupModelPorts() {
  try {
    const modelsConfig = loadModels();
    
    const ports = new Set();
    
    // Add router port
    if (modelsConfig.router && modelsConfig.router.port) {
      ports.add(modelsConfig.router.port);
    }
    
    // Add all model ports
    const models = modelsConfig.models || {};
    for (const [name, config] of Object.entries(models)) {
      if (config.type !== "remote" && config.port) {
        ports.add(config.port);
      }
    }
    
    if (ports.size === 0) {
      log.info("No ports to clean up");
      return;
    }
    
    log.info(`Cleaning up ${ports.size} port(s): ${Array.from(ports).join(', ')}`);
    
    let cleaned = 0;
    for (const port of ports) {
      const killed = await killPort(port);
      if (killed) cleaned++;
    }
    
    if (cleaned > 0) {
      log.success(`Cleaned up ${cleaned} port(s)`);
    } else {
      log.info("All ports were already clean");
    }
    
  } catch (err) {
    log.error("Failed to clean up ports:", err.message);
  }
}

module.exports = {
  killPort,
  cleanupModelPorts
};
