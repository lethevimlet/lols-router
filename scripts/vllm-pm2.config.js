module.exports = {
  apps: [{
    name: 'vllm-qwen-14b',
    script: '/home/ai/vllm/venv/bin/python',
    args: '-m vllm.entrypoints.openai.api_server --model /home/ai/vllm/models/Qwen2.5-Coder-14B-Instruct --host 0.0.0.0 --port 8027 --max-model-len 81920 --gpu-memory-utilization 0.90 --dtype auto --trust-remote-code --served-model-name qwen2.5-coder-14b-instruct-vllm',
    cwd: '/home/ai/vllm',
    interpreter: 'none',
    env: {
      CUDA_VISIBLE_DEVICES: '0',
      VLLM_USE_MODELSCOPE: 'False'
    },
    max_memory_restart: '14G',
    error_file: '/home/ai/vllm/logs/error.log',
    out_file: '/home/ai/vllm/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    autorestart: true,
    watch: false
  }]
};
