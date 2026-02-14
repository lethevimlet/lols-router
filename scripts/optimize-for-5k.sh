#!/bin/bash
# Optimize llama.cpp config for 5k context to verify KV cache functionality

set -e

CONFIG_FILE=".env/models.json"
BACKUP_FILE=".env/models.json.backup-$(date +%s)"

echo "🔧 Optimizing llama.cpp for 5k context"
echo ""

# Backup current config
echo "📦 Backing up current config..."
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "   Backup saved: $BACKUP_FILE"
echo ""

# Create optimized config using jq
echo "⚙️  Creating optimized config for 5k context..."
cat "$CONFIG_FILE" | jq '
  .models."qwen2.5.1-coder-7b-instruct" |= {
    type: "llama-cpp",
    repo: "bartowski/Qwen2.5.1-Coder-7B-Instruct-GGUF",
    file: "Qwen2.5.1-Coder-7B-Instruct-Q4_K_M.gguf",
    context: 8192,
    port: 8027,
    systemPrompt: "You are Qwen, an expert coding and reasoning AI assistant developed by Alibaba Cloud. You excel at programming, mathematics, and complex problem-solving.",
    timeout: 300,
    maxTokens: 2048,
    performance: {
      flashAttention: false,
      batch: 4096,
      ubatch: 512,
      threads: 12,
      parallel: 2,
      contBatching: false,
      cacheTypeK: "f16",
      cacheTypeV: "f16"
    }
  }
' > "$CONFIG_FILE.tmp"

mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

echo "✅ Optimizations applied:"
echo "   • Context: 131072 → 8192 (optimized for 5k)"
echo "   • KV cache: q4_0 → f16 (better quality)"
echo "   • Batch: 8192 → 4096 (faster iteration)"
echo "   • ubatch: 2048 → 512 (smaller generation batches)"
echo "   • Flash attention: true → false (simpler path)"
echo "   • Parallel: 1 → 2 (might help generation)"
echo "   • Cont batching: true → false (simpler path)"
echo "   • Max tokens: 16384 → 2048 (reasonable output)"
echo ""
echo "💾 Backup available at: $BACKUP_FILE"
echo ""
echo "🔄 Restart lols-router to apply changes:"
echo "   pm2 restart lols-router"
