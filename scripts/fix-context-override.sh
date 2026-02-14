#!/bin/bash
# Add --override-kv to force llama.cpp to use full context in slots

set -e

cd ~/lols-router

echo "🔧 Patching llama.js to add --override-kv support..."

# Backup first
cp src/helpers/llama.js src/helpers/llama.js.backup-context

# Add override-kv logic after the context check
cat > /tmp/llama-patch.txt << 'EOF'
  if (cfg.context) {
    args.push("-c", String(cfg.context));
    console.log("[llama] Context size:", cfg.context);
    
    // Override model metadata to force slots to use full context
    const overrides = [
      `llama.context_length=int:${cfg.context}`,
      `qwen2.context_length=int:${cfg.context}`
    ].join(',');
    args.push("--override-kv", overrides);
    console.log("[llama] Overriding model context metadata to:", cfg.context);
  }
EOF

# Replace the old context logic with the new one
sed -i '/if (cfg.context) {/,/}/c\
  if (cfg.context) {\
    args.push("-c", String(cfg.context));\
    console.log("[llama] Context size:", cfg.context);\
    \
    // Override model metadata to force slots to use full context\
    const overrides = [\
      `llama.context_length=int:${cfg.context}`,\
      `qwen2.context_length=int:${cfg.context}`\
    ].join(",");\
    args.push("--override-kv", overrides);\
    console.log("[llama] Overriding model context metadata to:", cfg.context);\
  }' src/helpers/llama.js

echo "✅ Patch applied!"
echo "💾 Backup saved: src/helpers/llama.js.backup-context"
echo ""
echo "🔄 Restart lols-router to apply:"
echo "   pm2 restart lols-router"
