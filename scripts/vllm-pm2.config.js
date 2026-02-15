module.exports = {
  apps: [{
    name: 'vllm-qwen-14b',
    script: '/home/ai/vllm/venv/bin/python',
    args: '-m vllm.entrypoints.openai.api_server --model /home/ai/vllm/models/Qwen2.5-Coder-14B-Instruct-AWQ --host 0.0.0.0 --port 8027 --max-model-len 26000 --gpu-memory-utilization 0.95 --quantization awq --dtype auto --trust-remote-code --served-model-name qwen2.5-coder-14b-instruct-vllm --max-num-seqs 4 --enforce-eager',
    cwd: '/home/ai/vllm',
    interpreter: 'none',
    env: {
      CUDA_VISIBLE_DEVICES: '0',
      VLLM_USE_MODELSCOPE: 'False',
      VLLM_ALLOW_LONG_MAX_MODEL_LEN: '1'
    },
    max_memory_restart: '14G',
    error_file: '/home/ai/vllm/logs/error.log',
    out_file: '/home/ai/vllm/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    autorestart: true,
    watch: false
  }]
};
