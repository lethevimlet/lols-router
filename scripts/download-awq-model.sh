#!/bin/bash

# Download AWQ quantized Qwen2.5-Coder-14B (4-bit)
# Much smaller (~8GB vs 28GB) and fits in 16GB VRAM

cd ~/vllm
source venv/bin/activate

echo "📥 Downloading AWQ 4-bit quantized Qwen2.5-Coder-14B..."
echo "This is ~8GB (vs 28GB for full precision)"
echo ""

python -c "
from huggingface_hub import snapshot_download
import os

# AWQ quantized version from TheBloke or similar
model_id = 'Qwen/Qwen2.5-Coder-14B-Instruct-AWQ'
cache_dir = os.path.expanduser('~/vllm/models')

print(f'Downloading {model_id}...')
try:
    snapshot_download(
        repo_id=model_id,
        cache_dir=cache_dir,
        local_dir=os.path.join(cache_dir, 'Qwen2.5-Coder-14B-Instruct-AWQ'),
        local_dir_use_symlinks=False
    )
    print('✅ Download complete!')
except Exception as e:
    print(f'❌ Official AWQ not found, trying community version...')
    # Try community quantization
    model_id = 'solidrust/Qwen2.5-Coder-14B-Instruct-AWQ'
    try:
        snapshot_download(
            repo_id=model_id,
            cache_dir=cache_dir,
            local_dir=os.path.join(cache_dir, 'Qwen2.5-Coder-14B-Instruct-AWQ'),
            local_dir_use_symlinks=False
        )
        print('✅ Download complete!')
    except Exception as e2:
        print(f'❌ Error: {e2}')
        print('Trying GPTQ version instead...')
        model_id = 'Qwen/Qwen2.5-Coder-14B-Instruct-GPTQ-Int4'
        snapshot_download(
            repo_id=model_id,
            cache_dir=cache_dir,
            local_dir=os.path.join(cache_dir, 'Qwen2.5-Coder-14B-Instruct-AWQ'),
            local_dir_use_symlinks=False
        )
        print('✅ GPTQ model downloaded!')
"

echo ""
echo "✅ Quantized model ready!"
echo "Model location: ~/vllm/models/Qwen2.5-Coder-14B-Instruct-AWQ"
