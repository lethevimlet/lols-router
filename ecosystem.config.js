module.exports = {
  apps: [{
    name: 'lols-router',
    script: 'src/server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production'
    },
    // Disable log files - use 'pm2 logs' to view output
    error_file: '/dev/null',
    out_file: '/dev/null',
    log_file: '/dev/null',
    time: false,
    merge_logs: true,
    // Restart configuration
    min_uptime: '10s',
    max_restarts: 10,
    // Kill timeout for graceful shutdown
    kill_timeout: 5000,
    // Wait time before restart
    restart_delay: 4000,
    // Source map support
    source_map_support: true,
    // Instance variables
    instance_var: 'INSTANCE_ID'
  }]
};
