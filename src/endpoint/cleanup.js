const express = require('express');
const router = express.Router();
const { createLogger } = require('../helpers/logger');
const { loadModels } = require('../helpers/config');
const { killPort } = require('../helpers/cleanup');

const log = createLogger('api-cleanup');

/**
 * POST /v1/cleanup
 * Kill all running models except the router
 */
router.post('/v1/cleanup', async (req, res) => {
  try {
    log.info('Cleanup requested - killing all models except router');
    
    const modelsConfig = loadModels();
    const routerPort = modelsConfig.router?.port || 3001;
    
    const ports = [];
    const models = modelsConfig.models || {};
    
    // Collect all model ports (except remote models)
    for (const [name, config] of Object.entries(models)) {
      if (config.type !== "remote" && config.port && config.port !== routerPort) {
        ports.push({ name, port: config.port });
      }
    }
    
    if (ports.length === 0) {
      log.info('No model ports to clean up');
      return res.json({
        success: true,
        message: 'No models to clean up',
        cleaned: 0,
        ports: []
      });
    }
    
    log.info(`Cleaning up ${ports.length} model port(s): ${ports.map(p => `${p.name}:${p.port}`).join(', ')}`);
    
    const results = [];
    let cleaned = 0;
    
    for (const { name, port } of ports) {
      try {
        const killed = await killPort(port);
        if (killed) {
          log.success(`Killed ${name} on port ${port}`);
          results.push({ name, port, success: true });
          cleaned++;
        } else {
          log.info(`${name} on port ${port} was not running`);
          results.push({ name, port, success: true, wasRunning: false });
        }
      } catch (err) {
        log.error(`Failed to kill ${name} on port ${port}:`, err.message);
        results.push({ name, port, success: false, error: err.message });
      }
    }
    
    res.json({
      success: true,
      message: `Cleaned up ${cleaned} model(s)`,
      cleaned,
      total: ports.length,
      results
    });
    
  } catch (err) {
    log.error('Cleanup failed:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /v1/cleanup/status
 * Get status of all model ports
 */
router.get('/v1/cleanup/status', async (req, res) => {
  try {
    const { execaCommand } = require('execa');
    const modelsConfig = loadModels();
    const routerPort = modelsConfig.router?.port || 3001;
    
    const ports = [];
    const models = modelsConfig.models || {};
    
    // Collect all model ports
    for (const [name, config] of Object.entries(models)) {
      if (config.type !== "remote" && config.port) {
        const isRouter = config.port === routerPort;
        
        // Check if port is in use
        let isRunning = false;
        try {
          const { stdout } = await execaCommand(`lsof -ti:${config.port}`, {
            reject: false,
            timeout: 2000
          });
          isRunning = stdout.trim().length > 0;
        } catch (err) {
          // Ignore errors
        }
        
        ports.push({
          name,
          port: config.port,
          isRouter,
          isRunning
        });
      }
    }
    
    res.json({
      success: true,
      ports,
      routerPort
    });
    
  } catch (err) {
    log.error('Status check failed:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
