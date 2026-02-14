/**
 * Temporary File Cleanup Utility
 * 
 * Cleans up temporary files created during testing and operations
 * Images are never persisted - they're processed in memory and discarded
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Clean up old temporary files from system temp directory
 * @param {number} maxAgeMinutes - Maximum age of files to keep (default: 60 minutes)
 */
function cleanupOldTempFiles(maxAgeMinutes = 60) {
  const tmpDir = os.tmpdir();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  const now = Date.now();
  
  const patterns = [
    /^curl-body-\d+\.json$/,  // Test temp files
  ];
  
  let cleaned = 0;
  let errors = 0;
  
  try {
    const files = fs.readdirSync(tmpDir);
    
    for (const file of files) {
      // Only process files matching our patterns
      if (!patterns.some(pattern => pattern.test(file))) {
        continue;
      }
      
      const filePath = path.join(tmpDir, file);
      
      try {
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (err) {
        // File might have been deleted already
        errors++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[temp-cleanup] Cleaned ${cleaned} old temp file(s) (age > ${maxAgeMinutes}min)`);
    }
    
    if (errors > 0 && errors < 5) {
      console.log(`[temp-cleanup] ${errors} file(s) already deleted or inaccessible`);
    }
  } catch (err) {
    console.error(`[temp-cleanup] Error scanning temp directory: ${err.message}`);
  }
}

/**
 * Start periodic cleanup of temp files
 * @param {number} intervalMinutes - How often to run cleanup (default: 30 minutes)
 * @param {number} maxAgeMinutes - Maximum age of files to keep (default: 60 minutes)
 */
function startPeriodicCleanup(intervalMinutes = 30, maxAgeMinutes = 60) {
  // Run cleanup immediately on start
  cleanupOldTempFiles(maxAgeMinutes);
  
  // Schedule periodic cleanup
  const intervalMs = intervalMinutes * 60 * 1000;
  const timer = setInterval(() => {
    cleanupOldTempFiles(maxAgeMinutes);
  }, intervalMs);
  
  // Allow Node.js to exit if this is the only thing keeping it alive
  timer.unref();
  
  console.log(`[temp-cleanup] Periodic cleanup started (every ${intervalMinutes}min, max age ${maxAgeMinutes}min)`);
  
  return () => clearInterval(timer);
}

module.exports = {
  cleanupOldTempFiles,
  startPeriodicCleanup
};
