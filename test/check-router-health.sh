#!/bin/bash
# Check router health on remote server

echo "🔍 Checking lols-router health on 192.168.0.21..."
echo

echo "1️⃣ Check if router port 3001 is listening:"
curl -m 2 http://192.168.0.21:3001/health 2>&1 || echo "❌ Router port 3001 not responding"
echo

echo "2️⃣ Check if main models endpoint works:"
curl -s -m 2 http://192.168.0.21:3000/v1/models | grep -o '"id"' | wc -l
echo " models found"
echo

echo "3️⃣ Test simple chat request:"
curl -s -m 5 -X POST http://192.168.0.21:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5.1-coder-7b-instruct","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' \
  2>&1 | head -3
echo

echo "📋 You need to check on the server (192.168.0.21):"
echo "   ssh user@192.168.0.21"
echo "   ps aux | grep llama-server    # Are llama processes running?"
echo "   netstat -tlnp | grep 3001      # Is router listening?"
echo "   pm2 logs lols-router --lines 200 | grep -i 'router\|startup'"
