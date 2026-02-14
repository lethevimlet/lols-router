const express = require("express");
const router = express.Router();

// Get current logging state
router.get("/v1/logging", (req, res) => {
  res.json({
    enabled: global.ENABLE_LOGGING || false,
    debug: global.DEBUG || false
  });
});

// Toggle logging on/off
router.post("/v1/logging/toggle", (req, res) => {
  const newState = !global.ENABLE_LOGGING;
  global.ENABLE_LOGGING = newState;
  
  console.log(`[logging] API request logging ${newState ? 'ENABLED' : 'DISABLED'}`);
  
  res.json({
    success: true,
    enabled: newState,
    message: `API request logging ${newState ? 'enabled' : 'disabled'}`
  });
});

// Set logging state explicitly
router.post("/v1/logging/set", (req, res) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean'
    });
  }
  
  global.ENABLE_LOGGING = enabled;
  console.log(`[logging] API request logging ${enabled ? 'ENABLED' : 'DISABLED'}`);
  
  res.json({
    success: true,
    enabled: enabled,
    message: `API request logging ${enabled ? 'enabled' : 'disabled'}`
  });
});

module.exports = router;
