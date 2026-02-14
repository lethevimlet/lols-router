/**
 * Colorful terminal logger
 * Simple ANSI color codes for better readability
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Component color mapping
const componentColors = {
  'server': colors.cyan,
  'ws': colors.magenta,
  'chat': colors.green,
  'model-router': colors.blue,
  'orchestrator': colors.yellow,
  'router-manager': colors.magenta,
  'system-metrics': colors.cyan,
  'remote-api': colors.blue,
  'cleanup': colors.yellow,
  'orch': colors.yellow,
  'llama': colors.green
};

/**
 * Get color code (respects colorOutput config)
 */
function getColor(color) {
  const colorEnabled = global.config?.logging?.colorOutput !== false;
  return colorEnabled ? color : '';
}

/**
 * Create a logger for a specific component
 */
function createLogger(component) {
  const color = componentColors[component] || colors.white;
  
  return {
    log: (...args) => {
      const prefix = `${getColor(color)}[${component}]${getColor(colors.reset)}`;
      console.log(prefix, ...args);
    },
    
    info: (...args) => {
      const prefix = `${getColor(color)}[${component}]${getColor(colors.reset)}`;
      console.log(prefix, getColor(colors.blue) + 'ℹ' + getColor(colors.reset), ...args);
    },
    
    success: (...args) => {
      const prefix = `${getColor(color)}[${component}]${getColor(colors.reset)}`;
      console.log(prefix, getColor(colors.green) + '✓' + getColor(colors.reset), ...args);
    },
    
    warn: (...args) => {
      const prefix = `${getColor(color)}[${component}]${getColor(colors.reset)}`;
      console.warn(prefix, getColor(colors.yellow) + '⚠' + getColor(colors.reset), ...args);
    },
    
    error: (...args) => {
      const prefix = `${getColor(color)}[${component}]${getColor(colors.reset)}`;
      console.error(prefix, getColor(colors.red) + '✗' + getColor(colors.reset), ...args);
    },
    
    debug: (...args) => {
      if (global.DEBUG) {
        const prefix = `${getColor(color)}[${component}]${getColor(colors.reset)}`;
        console.log(prefix, getColor(colors.dim) + '🔍' + getColor(colors.reset), ...args);
      }
    }
  };
}

/**
 * Log a banner/section
 */
function banner(text) {
  const line = '═'.repeat(text.length + 4);
  console.log('\n' + getColor(colors.bright) + getColor(colors.cyan) + line + getColor(colors.reset));
  console.log(getColor(colors.bright) + getColor(colors.cyan) + '  ' + text + '  ' + getColor(colors.reset));
  console.log(getColor(colors.bright) + getColor(colors.cyan) + line + getColor(colors.reset) + '\n');
}

module.exports = {
  createLogger,
  banner,
  colors
};
