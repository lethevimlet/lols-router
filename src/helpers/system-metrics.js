const os = require("os");
const { execaCommand } = require("execa");
const { createLogger } = require("./logger");

const log = createLogger("system-metrics");

/**
 * Get VRAM usage from nvidia-smi
 * Returns array of GPU info with memory usage and temperature
 */
async function getVRAMUsage() {
  try {
    // Query nvidia-smi for GPU memory info and temperature
    const { stdout } = await execaCommand(
      "nvidia-smi --query-gpu=index,memory.used,memory.total,name,temperature.gpu --format=csv,noheader,nounits",
      { timeout: 3000 }
    );

    const gpus = stdout.trim().split("\n").map(line => {
      const [index, used, total, name, temp] = line.split(", ");
      return {
        index: parseInt(index),
        used: parseInt(used),
        total: parseInt(total),
        name: name.trim(),
        temp: parseInt(temp),
        percent: (parseInt(used) / parseInt(total)) * 100
      };
    });

    return gpus;
  } catch (err) {
    log.error("nvidia-smi error:", err.message);
    return [];
  }
}

/**
 * Get LLM process info from nvidia-smi
 * Returns array of processes using GPU with model info
 */
async function getGPUProcesses() {
  try {
    const { stdout } = await execaCommand(
      "nvidia-smi --query-compute-apps=pid,used_memory,name --format=csv,noheader,nounits",
      { timeout: 3000 }
    );

    if (!stdout.trim()) {
      return [];
    }

    const processes = stdout.trim().split("\n").map(line => {
      const parts = line.split(", ");
      if (parts.length < 3) return null;
      
      const [pid, used, name] = parts;
      const pidInt = parseInt(pid);
      const vramInt = parseInt(used);
      
      // Skip invalid entries
      if (isNaN(pidInt) || isNaN(vramInt) || vramInt <= 0) {
        log.warn("Skipping invalid process:", line);
        return null;
      }
      
      // Enrich with model info from global registry
      const modelInfo = global.modelRegistry && global.modelRegistry.get(pidInt);
      
      return {
        pid: pidInt,
        vram: vramInt,
        name: name.trim(),
        modelName: modelInfo?.modelName || null,
        category: modelInfo?.category || null
      };
    }).filter(p => p !== null);

    return processes;
  } catch (err) {
    log.error("nvidia-smi processes error:", err.message);
    return [];
  }
}

/**
 * Get CPU usage percentage
 */
function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);

  return {
    percent: usage,
    cores: cpus.length
  };
}

/**
 * Get RAM usage
 */
function getRAMUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percent: (used / total) * 100
  };
}

/**
 * Get all system metrics
 */
async function getSystemMetrics() {
  const [vram, processes] = await Promise.all([
    getVRAMUsage(),
    getGPUProcesses()
  ]);

  const cpu = getCPUUsage();
  const ram = getRAMUsage();

  return {
    vram,
    processes,
    cpu,
    ram,
    timestamp: Date.now()
  };
}

module.exports = {
  getSystemMetrics,
  getVRAMUsage,
  getGPUProcesses,
  getCPUUsage,
  getRAMUsage
};
