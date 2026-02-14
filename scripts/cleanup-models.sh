#!/bin/bash
# Cleanup script for unused model files
# Removes old Qwen2.5 models that have been replaced by Qwen3

set -e

CACHE_DIR="${1:-$HOME/.cache/llama.cpp}"

echo "🧹 Cleaning up unused models in: $CACHE_DIR"
echo ""

# Models to remove (replaced by Qwen3)
MODELS_TO_REMOVE=(
  "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"
  "Qwen2.5-14B-Instruct-Q5_K_M.gguf"
)

TOTAL_FREED=0

for model in "${MODELS_TO_REMOVE[@]}"; do
  # Search for the model file
  echo "Searching for: $model"
  
  # Find all matching files
  FILES=$(find "$CACHE_DIR" -type f -name "$model" 2>/dev/null || true)
  
  if [ -z "$FILES" ]; then
    echo "  ⏭️  Not found (already removed or never downloaded)"
    echo ""
    continue
  fi
  
  # Remove each found file
  while IFS= read -r file; do
    if [ -f "$file" ]; then
      SIZE=$(du -h "$file" | cut -f1)
      SIZE_BYTES=$(du -b "$file" | cut -f1)
      echo "  🗑️  Removing: $file ($SIZE)"
      rm -f "$file"
      TOTAL_FREED=$((TOTAL_FREED + SIZE_BYTES))
    fi
  done <<< "$FILES"
  
  echo ""
done

if [ $TOTAL_FREED -gt 0 ]; then
  # Convert bytes to human readable
  FREED_GB=$(echo "scale=2; $TOTAL_FREED / 1024 / 1024 / 1024" | bc)
  echo "✅ Cleanup complete! Freed: ${FREED_GB} GB"
else
  echo "✅ No files removed (already clean)"
fi

echo ""
echo "Remaining models:"
find "$CACHE_DIR" -type f -name "*.gguf" -o -name "*.bin" 2>/dev/null | while read -r file; do
  SIZE=$(du -h "$file" | cut -f1)
  echo "  📦 $(basename "$file") ($SIZE)"
done
