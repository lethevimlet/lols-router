// WebSocket Log Broadcasting - Version 2.0
console.log('[lols-router] WebUI script loaded - Log broadcasting enabled v2.0');

// DOM elements
const currentModelEl = document.getElementById('currentModel');
const wsStatusEl = document.getElementById('wsStatus');
const modelSelect = document.getElementById('modelSelect');
const messageInput = document.getElementById('messageInput');
const maxTokensCheckbox = document.getElementById('maxTokensCheckbox');
const maxTokensInput = document.getElementById('maxTokensInput');
const timeoutInput = document.getElementById('timeoutInput');
const streamCheckbox = document.getElementById('streamCheckbox');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const outputEl = document.getElementById('output');
const currentCategoryEl = document.getElementById('currentCategory');
const tokensPerSecEl = document.getElementById('tokensPerSec');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const clearImageBtn = document.getElementById('clearImageBtn');
const audioInput = document.getElementById('audioInput');
const audioPreview = document.getElementById('audioPreview');
const clearAudioBtn = document.getElementById('clearAudioBtn');
const testTranscribeBtn = document.getElementById('testTranscribeBtn');
const loggingToggleBtn = document.getElementById('loggingToggleBtn');
const loggingStateEl = document.getElementById('loggingState');

// Metrics elements
const vramTextEl = document.getElementById('vramText');
const vramBarEl = document.getElementById('vramBar');
const vramSegmentsEl = document.getElementById('vramSegments');
const gpuNameEl = document.getElementById('gpuName');
const gpuTempEl = document.getElementById('gpuTemp');
const cpuTextEl = document.getElementById('cpuText');
const cpuBarEl = document.getElementById('cpuBar');
const ramTextEl = document.getElementById('ramText');
const ramBarEl = document.getElementById('ramBar');

// Model info elements
const toggleModelInfoBtn = document.getElementById('toggleModelInfo');
const modelInfoContent = document.getElementById('modelInfoContent');
const contextSizeEl = document.getElementById('contextSize');
const maxTokensDisplayEl = document.getElementById('maxTokensDisplay');
const timeoutDisplayEl = document.getElementById('timeoutDisplay');
const systemPromptEl = document.getElementById('systemPrompt');
const copyPromptBtn = document.getElementById('copyPromptBtn');

// State
let ws = null;
let reconnectTimer = null;
let uploadedImage = null; // Stores base64 image data
let uploadedAudio = null; // Stores File object for audio

// Console styling (for DevTools debugging only - not shown in chat)
const logStyles = {
  info: 'color: #3b82f6; font-weight: bold',
  success: 'color: #10b981; font-weight: bold',
  warn: 'color: #f59e0b; font-weight: bold',
  error: 'color: #ef4444; font-weight: bold',
  debug: 'color: #8b5cf6; font-weight: bold',
  data: 'color: #06b6d4; font-weight: bold'
};

function logConsole(type, ...args) {
  console.log(`%c${type.toUpperCase()}`, logStyles[type] || '', ...args);
}

function logRaw(label, data) {
  console.log(`%c[RAW] ${label}`, logStyles.data, JSON.stringify(data, null, 2));
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

let streamContentDiv = null;

// Initialize
init();

function init() {
  setupWebSocket();
  setupEventListeners();
  loadAvailableModels();
  loadLoggingState();
}

// WebSocket setup
function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    // Connection status shown in status indicator, no need to log
    wsStatusEl.classList.remove('disconnected');
    wsStatusEl.classList.add('connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    } catch (err) {
      logConsole('error', 'WebSocket message parse error:', err);
    }
  };
  
  ws.onerror = (error) => {
    logConsole('error', '✗ WebSocket error:', error);
  };
  
  ws.onclose = () => {
    wsStatusEl.classList.remove('connected');
    wsStatusEl.classList.add('disconnected');
    currentModelEl.textContent = 'Disconnected';
    
    // Reconnect after 3 seconds
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        setupWebSocket();
      }, 3000);
    }
  };
}

function handleWebSocketMessage(data) {
  if (data.type === 'modelStatus') {
    if (data.model) {
      currentModelEl.textContent = data.model;
      if (data.modelType === 'remote') {
        currentModelEl.textContent += ' (remote)';
      } else if (data.modelType === 'llama-cpp') {
        currentModelEl.textContent += ` :${data.port || '?'}`;
      }
      
      // Update context size
      if (data.context) {
        contextSizeEl.textContent = data.context.toLocaleString() + ' tokens';
        contextSizeEl.style.color = '#10b981'; // Green for configured
      } else {
        contextSizeEl.textContent = 'Not configured';
        contextSizeEl.style.color = '#f59e0b'; // Orange for missing
      }
      
      // Update max tokens
      if (data.maxTokens) {
        maxTokensDisplayEl.textContent = data.maxTokens.toLocaleString() + ' tokens';
        maxTokensDisplayEl.style.color = '#10b981'; // Green for configured
      } else {
        maxTokensDisplayEl.textContent = 'Not configured (default: 2000)';
        maxTokensDisplayEl.style.color = '#f59e0b'; // Orange for missing
      }
      
      // Update timeout
      if (data.timeout) {
        timeoutDisplayEl.textContent = data.timeout + 's';
        timeoutDisplayEl.style.color = '#10b981'; // Green for configured
      } else {
        timeoutDisplayEl.textContent = 'Not configured (default: 30s)';
        timeoutDisplayEl.style.color = '#f59e0b'; // Orange for missing
      }
      
      // Update system prompt (from model config - default display)
      if (data.systemPrompt) {
        systemPromptEl.textContent = data.systemPrompt;
        systemPromptEl.style.color = '#e5e7eb'; // Light gray for text
        copyPromptBtn.disabled = false;
        
        // Remove any existing source badge
        const existingBadge = systemPromptEl.parentElement.querySelector('.prompt-source-badge');
        if (existingBadge) {
          existingBadge.remove();
        }
      } else {
        systemPromptEl.textContent = 'No system prompt configured';
        systemPromptEl.style.color = '#9ca3af'; // Dimmed for missing
        copyPromptBtn.disabled = true;
      }
    } else {
      currentModelEl.textContent = 'No model loaded';
      contextSizeEl.textContent = '-';
      contextSizeEl.style.color = '#9ca3af';
      maxTokensDisplayEl.textContent = '-';
      maxTokensDisplayEl.style.color = '#9ca3af';
      timeoutDisplayEl.textContent = '-';
      timeoutDisplayEl.style.color = '#9ca3af';
      systemPromptEl.textContent = 'No model loaded';
      systemPromptEl.style.color = '#9ca3af';
      copyPromptBtn.disabled = true;
    }
  } else if (data.type === 'systemPromptUsed') {
    // Update with ACTUAL system prompt used in the request (with source)
    if (data.systemPrompt) {
      systemPromptEl.textContent = data.systemPrompt;
      systemPromptEl.style.color = '#e5e7eb'; // Light gray for text
      copyPromptBtn.disabled = false;
      
      // Remove any existing source badge
      const existingBadge = systemPromptEl.parentElement.querySelector('.prompt-source-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      
      // Add source badge
      const sourceBadge = document.createElement('span');
      sourceBadge.className = 'prompt-source-badge';
      sourceBadge.style.cssText = 'display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; vertical-align: middle;';
      
      // Color code by source
      if (data.source === 'user-provided') {
        sourceBadge.textContent = '👤 USER';
        sourceBadge.style.backgroundColor = '#3b82f6'; // Blue
        sourceBadge.style.color = '#ffffff';
      } else if (data.source === 'category-level') {
        sourceBadge.textContent = '📂 CATEGORY';
        sourceBadge.style.backgroundColor = '#10b981'; // Green
        sourceBadge.style.color = '#ffffff';
      } else if (data.source === 'model-level') {
        sourceBadge.textContent = '⚙️ MODEL';
        sourceBadge.style.backgroundColor = '#6b7280'; // Gray
        sourceBadge.style.color = '#ffffff';
      }
      
      // Insert badge after "System Prompt:" label
      const labelElement = systemPromptEl.previousElementSibling;
      if (labelElement && labelElement.textContent.includes('System Prompt:')) {
        labelElement.appendChild(sourceBadge);
      }
    }
  } else if (data.type === 'categoryStatus') {
    if (data.category) {
      currentCategoryEl.textContent = data.category.toUpperCase();
      // Routing info shown in category badge, no need to log
    }
  } else if (data.type === 'systemMetrics') {
    updateSystemMetrics(data.metrics);
  } else if (data.type === 'log') {
    // Server logs - display in UI output panel
    console.log('[WebSocket LOG received]', data);
    const logText = `[${data.source}] ${data.message}`;
    log(logText, 'info');
  }
}

// Update system metrics display
function updateSystemMetrics(metrics) {
  if (!metrics) return;
  
  // Update VRAM
  if (metrics.vram && metrics.vram.length > 0) {
    const gpu = metrics.vram[0]; // Use first GPU
    const usedGB = (gpu.used / 1024).toFixed(1);
    const totalGB = (gpu.total / 1024).toFixed(1);
    const percent = Math.round(gpu.percent);
    vramTextEl.textContent = `${usedGB} GB / ${totalGB} GB (${percent}%)`;
    // Note: vramBar width is always 100% (set in CSS), segments show actual usage
    
    // Update GPU name
    if (gpu.name) {
      // Shorten common GPU names for display
      let displayName = gpu.name
        .replace('NVIDIA ', '')
        .replace('GeForce ', '')
        .replace('RTX ', 'RTX')
        .replace('GTX ', 'GTX');
      gpuNameEl.textContent = displayName;
      gpuNameEl.title = gpu.name; // Full name in tooltip
    }
    
    // Update GPU temperature
    if (gpu.temp !== undefined) {
      gpuTempEl.textContent = `${gpu.temp}°C`;
      
      // Color code temperature
      if (gpu.temp < 60) {
        gpuTempEl.className = 'gpu-temp temp-cool';
      } else if (gpu.temp < 75) {
        gpuTempEl.className = 'gpu-temp temp-warm';
      } else {
        gpuTempEl.className = 'gpu-temp temp-hot';
      }
    }
    
    // Update VRAM segments for each process
    updateVRAMSegments(gpu, metrics.processes);
  } else {
    vramTextEl.textContent = 'No GPU';
    vramBarEl.style.width = '0%';
    gpuNameEl.textContent = 'GPU';
    gpuTempEl.textContent = '--°C';
  }
  
  // Update CPU
  if (metrics.cpu) {
    cpuTextEl.textContent = `${Math.round(metrics.cpu.percent)}%`;
    cpuBarEl.style.width = `${metrics.cpu.percent}%`;
  }
  
  // Update RAM
  if (metrics.ram) {
    const usedGB = (metrics.ram.used / 1024).toFixed(1);
    const totalGB = (metrics.ram.total / 1024).toFixed(1);
    const percent = Math.round(metrics.ram.percent);
    ramTextEl.textContent = `${usedGB} GB / ${totalGB} GB (${percent}%)`;
    ramBarEl.style.width = `${metrics.ram.percent}%`;
  }
}

// Update VRAM segments to show individual LLM processes
function updateVRAMSegments(gpu, processes) {
  // Don't render segments if no valid processes
  if (!processes || processes.length === 0) {
    vramSegmentsEl.innerHTML = '';
    return;
  }
  
  // CRITICAL: Don't render segments on initial load before real data arrives
  // Check if this is real data (has PIDs) or placeholder data
  const hasRealData = processes.some(p => p && p.pid && p.vram > 0);
  if (!hasRealData) {
    vramSegmentsEl.innerHTML = '';
    return;
  }
  
  // Clear existing segments (force clear to prevent phantom segments)
  vramSegmentsEl.innerHTML = '';
  while (vramSegmentsEl.firstChild) {
    vramSegmentsEl.removeChild(vramSegmentsEl.firstChild);
  }
  
  // Create segment for each process
  processes.forEach((proc, index) => {
    // Validate process data
    if (!proc || !proc.pid || !proc.vram || proc.vram <= 0) {
      return;
    }
    
    const percent = (proc.vram / gpu.total) * 100;
    
    // Skip segments too small to render
    if (percent < 0.1) {
      return;
    }
    
    const segment = document.createElement('div');
    segment.className = 'vram-segment';
    segment.style.width = `${percent}%`;
    
    // Assign color based on process name or index
    const colorIndex = index % 5; // Cycle through 5 colors
    segment.classList.add(`segment-color-${colorIndex}`);
    
    // Tooltip with model name, category, and process info
    let tooltip = '';
    if (proc.modelName) {
      tooltip += `Model: ${proc.modelName}\n`;
    }
    if (proc.category) {
      tooltip += `Category: ${proc.category.toUpperCase()}\n`;
    }
    tooltip += `PID: ${proc.pid}\n`;
    tooltip += `VRAM: ${proc.vram} MB (${percent.toFixed(1)}%)`;
    
    segment.title = tooltip;
    
    vramSegmentsEl.appendChild(segment);
  });
}

// Event listeners
function setupEventListeners() {
  sendBtn.addEventListener('click', sendTestRequest);
  clearBtn.addEventListener('click', clearOutput);
  
  // Send on Ctrl+Enter
  messageInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      sendTestRequest();
    }
  });
  
  // Enable/disable max tokens input based on checkbox
  maxTokensCheckbox.addEventListener('change', () => {
    maxTokensInput.disabled = !maxTokensCheckbox.checked;
  });
  
  // Image upload handling
  imageInput.addEventListener('change', handleImageUpload);
  clearImageBtn.addEventListener('click', clearImage);
  
  // Audio upload handling
  audioInput.addEventListener('change', handleAudioUpload);
  clearAudioBtn.addEventListener('click', clearAudio);
  testTranscribeBtn.addEventListener('click', testTranscription);
  
  // Model info toggle
  toggleModelInfoBtn.addEventListener('click', toggleModelInfo);
  
  // Copy system prompt
  copyPromptBtn.addEventListener('click', copySystemPrompt);
}

// Toggle model info visibility
function toggleModelInfo() {
  const isHidden = modelInfoContent.style.display === 'none';
  modelInfoContent.style.display = isHidden ? 'block' : 'none';
  toggleModelInfoBtn.textContent = isHidden ? 'Hide Details' : 'Show Details';
}

// Copy system prompt to clipboard
async function copySystemPrompt() {
  const promptText = systemPromptEl.textContent;
  
  if (!promptText || promptText === 'No system prompt configured' || promptText === 'No model loaded') {
    return;
  }
  
  try {
    await navigator.clipboard.writeText(promptText);
    
    // Visual feedback
    const originalText = copyPromptBtn.textContent;
    copyPromptBtn.textContent = '✅ Copied!';
    copyPromptBtn.style.backgroundColor = '#10b981';
    
    setTimeout(() => {
      copyPromptBtn.textContent = originalText;
      copyPromptBtn.style.backgroundColor = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    copyPromptBtn.textContent = '❌ Failed';
    setTimeout(() => {
      copyPromptBtn.textContent = '📋 Copy';
    }, 2000);
  }
}

// Handle image upload
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file');
    imageInput.value = '';
    return;
  }
  
  // Read file as base64
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImage = e.target.result;
    
    // Show preview
    imagePreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = uploadedImage;
    img.alt = 'Uploaded image preview';
    imagePreview.appendChild(img);
    
    // Show clear button
    clearImageBtn.style.display = 'inline-block';
    
    log(`✓ Image uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info');
  };
  reader.onerror = () => {
    alert('Failed to read image file');
    imageInput.value = '';
  };
  reader.readAsDataURL(file);
}

// Clear uploaded image
function clearImage() {
  uploadedImage = null;
  imageInput.value = '';
  imagePreview.innerHTML = '';
  clearImageBtn.style.display = 'none';
  log('Image cleared', 'info');
}

// Handle audio upload
function handleAudioUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 
                      'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 
                      'audio/x-m4a', 'audio/flac'];
  const validExtensions = /\.(mp3|wav|ogg|webm|m4a|flac)$/i;
  
  if (!validTypes.includes(file.type) && !validExtensions.test(file.name)) {
    alert('Please upload an audio file (mp3, wav, ogg, webm, m4a, flac)');
    audioInput.value = '';
    return;
  }
  
  // Check file size (max 25 MB)
  if (file.size > 25 * 1024 * 1024) {
    alert('Audio file too large (max 25 MB)');
    audioInput.value = '';
    return;
  }
  
  // Store file object
  uploadedAudio = file;
  
  // Show preview with file info
  audioPreview.innerHTML = '';
  const infoDiv = document.createElement('div');
  infoDiv.className = 'audio-info';
  infoDiv.innerHTML = `
    <span>🎵 ${file.name}</span>
    <span class="audio-size">${(file.size / 1024).toFixed(1)} KB</span>
  `;
  audioPreview.appendChild(infoDiv);
  
  // Show buttons
  clearAudioBtn.style.display = 'inline-block';
  testTranscribeBtn.style.display = 'inline-block';
  
  log(`✓ Audio uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info');
}

// Clear uploaded audio
function clearAudio() {
  uploadedAudio = null;
  audioInput.value = '';
  audioPreview.innerHTML = '';
  clearAudioBtn.style.display = 'none';
  testTranscribeBtn.style.display = 'none';
  log('Audio cleared', 'info');
}

// Test transcription
async function testTranscription() {
  if (!uploadedAudio) {
    alert('Please upload an audio file first');
    return;
  }
  
  const modelName = 'whisper-small'; // Default whisper model
  
  try {
    log(`🎙️ Transcribing audio with ${modelName}...`, 'info');
    testTranscribeBtn.disabled = true;
    testTranscribeBtn.textContent = 'Transcribing...';
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', uploadedAudio);
    formData.append('model', modelName);
    formData.append('response_format', 'verbose_json');
    
    const response = await fetch('/v1/audio/transcriptions', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Transcription failed');
    }
    
    const result = await response.json();
    
    // Display result in output
    log(`✓ Transcription complete`, 'success');
    log(`Transcribed text: ${result.text}`, 'info');
    
    const outputHTML = `
      <div class="message assistant">
        <div class="message-header">Transcription Result (${escapeHtml(modelName)})</div>
        <div class="message-content">
          <strong>Text:</strong><br>
          ${escapeHtml(result.text)}
          ${result.language ? `<br><br><strong>Language:</strong> ${escapeHtml(result.language)}` : ''}
          ${result.duration ? `<br><strong>Duration:</strong> ${result.duration.toFixed(2)}s` : ''}
        </div>
      </div>
    `;
    
    outputEl.innerHTML += outputHTML;
    outputEl.scrollTop = outputEl.scrollHeight;
    
  } catch (error) {
    log(`✗ Transcription error: ${error.message}`, 'error');
    alert(`Transcription failed: ${error.message}`);
  } finally {
    testTranscribeBtn.disabled = false;
    testTranscribeBtn.textContent = 'Transcribe';
  }
}

// Load available models
async function loadAvailableModels() {
  try {
    const response = await fetch('/v1/models');
    const data = await response.json();
    
    if (data.data && Array.isArray(data.data)) {
      // Update dropdown with available models
      modelSelect.innerHTML = '';
      
      // Add lols-smart first
      const smartOption = document.createElement('option');
      smartOption.value = 'lols-smart';
      smartOption.textContent = 'lols-smart (intelligent routing)';
      modelSelect.appendChild(smartOption);
      
      // Add other models
      data.data
        .filter(m => m.id !== 'lols-smart')
        .forEach(model => {
          const option = document.createElement('option');
          option.value = model.id;
          option.textContent = `${model.id} (${model.owned_by})`;
          modelSelect.appendChild(option);
        });
    }
  } catch (err) {
    console.error('Failed to load models:', err);
  }
}

// Fetch with timeout wrapper
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  }
}

// Send test request
async function sendTestRequest() {
  const model = modelSelect.value;
  const message = messageInput.value.trim();
  const stream = streamCheckbox.checked;
  const limitMaxTokens = maxTokensCheckbox.checked;
  const maxTokens = parseInt(maxTokensInput.value) || 2000;
  const timeout = parseInt(timeoutInput.value) || 30;
  
  if (!message) {
    alert('Please enter a message');
    return;
  }
  
  sendBtn.disabled = true;
  sendBtn.innerHTML = 'Sending... <span class="spinner"></span>';
  
  // Clear tokens/sec from previous request
  tokensPerSecEl.textContent = '';
  
  // Build message content (text or multimodal with image)
  let messageContent;
  if (uploadedImage) {
    // Multimodal format (OpenAI-compatible)
    messageContent = [
      { type: 'text', text: message },
      { type: 'image_url', image_url: { url: uploadedImage } }
    ];
  } else {
    messageContent = message;
  }
  
  const payload = {
    model: model,
    messages: [
      { role: 'user', content: messageContent }
    ],
    stream: stream
  };
  
  // Only include max_tokens if checkbox is checked
  if (limitMaxTokens) {
    payload.max_tokens = maxTokens;
  }
  
  log(`→ REQUEST: POST /v1/chat/completions`, 'request');
  log(JSON.stringify(payload, null, 2), 'request');
  
  const startTime = Date.now();
  let loadingLogShown = false;
  
  // Show "model loading" message after 5 seconds (likely model swap happening)
  const loadingTimer = setTimeout(() => {
    loadingLogShown = true;
    log('⏳ Model loading or swapping... Large models (14B+) can take 60-90 seconds to load. Please wait.', 'info');
    sendBtn.innerHTML = 'Model Loading... <span class="spinner"></span>';
  }, 5000);
  
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Send custom timeout header
    if (timeout) {
      headers['X-Request-Timeout'] = timeout.toString();
    }
    
    // Use extended timeout for fetch (model loading can take 90+ seconds)
    // Add extra 60 seconds on top of server timeout to allow for model loading
    const fetchTimeout = (timeout + 90) * 1000;
    
    const response = await fetchWithTimeout('/v1/chat/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    }, fetchTimeout);
    
    clearTimeout(loadingTimer);
    
    const elapsed = Date.now() - startTime;
    log(`← RESPONSE: ${response.status} ${response.statusText} (${elapsed}ms)`, 'response');
    
    if (loadingLogShown && elapsed > 10000) {
      log(`✓ Model ready (took ${(elapsed / 1000).toFixed(1)}s)`, 'success');
    }
    
    if (stream) {
      await handleStreamResponse(response);
    } else {
      await handleJsonResponse(response);
    }
  } catch (err) {
    clearTimeout(loadingTimer);
    log(`✗ ERROR: ${err.message}`, 'error');
    
    if (err.message.includes('timeout')) {
      log('💡 Tip: Large models may need more time. Try increasing the timeout or restarting the server.', 'info');
    }
    
    console.error(err);
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Send Test Request';
  }
}

async function handleJsonResponse(response) {
  const text = await response.text();
  
  if (!response.ok) {
    log(text, 'error');
    return;
  }
  
  try {
    const data = JSON.parse(text);
    log(JSON.stringify(data, null, 2), 'response');
  } catch (err) {
    log(text, 'response');
  }
}

async function handleStreamResponse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  log('Streaming response...', 'response');
  
  let buffer = '';
  let fullContent = '';
  let tokenCount = 0;
  const startTime = Date.now();
  let lastDataTime = Date.now();
  
  // Stream inactivity timeout (30 seconds with no data = stream died)
  const STREAM_TIMEOUT = 30000;
  
  // Create a timeout checker
  const timeoutChecker = setInterval(() => {
    const timeSinceLastData = Date.now() - lastDataTime;
    if (timeSinceLastData > STREAM_TIMEOUT) {
      clearInterval(timeoutChecker);
      reader.cancel();
      log('⚠️ Stream timeout: No data received for 30 seconds', 'error');
      log('The model may have stopped responding. Try restarting the server or using a different model.', 'error');
    }
  }, 5000); // Check every 5 seconds
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        clearInterval(timeoutChecker);
        break;
      }
      
      // Update last data time
      lastDataTime = Date.now();
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            log('\n✓ Stream complete', 'response');
            clearInterval(timeoutChecker);
            return; // Exit cleanly
          }
          
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0] && json.choices[0].delta) {
              const delta = json.choices[0].delta.content;
              if (delta) {
                fullContent += delta;
                tokenCount++;
                
                // Update tokens/sec display
                const elapsedSec = (Date.now() - startTime) / 1000;
                if (elapsedSec > 0) {
                  const tokensPerSec = (tokenCount / elapsedSec).toFixed(1);
                  tokensPerSecEl.textContent = `${tokensPerSec} tokens/s`;
                }
                
                // Update last log entry with accumulated content
                updateStreamContent(fullContent);
              }
            }
          } catch (err) {
            // Ignore parse errors in streaming
          }
        }
      }
    }
  } catch (err) {
    clearInterval(timeoutChecker);
    throw err;
  } finally {
    clearInterval(timeoutChecker);
  }
  
  // Stream content already displayed via updateStreamContent()
  // No need to repeat it here
}

function updateStreamContent(content) {
  if (!streamContentDiv) {
    streamContentDiv = document.createElement('div');
    streamContentDiv.className = 'log-entry response';
    outputEl.appendChild(streamContentDiv);
  }
  streamContentDiv.textContent = '💬 ' + content;
  outputEl.scrollTop = outputEl.scrollHeight;
}

// Clear output
function clearOutput() {
  outputEl.innerHTML = '';
  streamContentDiv = null;
  log('Output cleared', 'info');
}

// Logging utility
function log(message, type = 'info') {
  streamContentDiv = null; // Reset stream div on new log
  
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  const timestampSpan = document.createElement('span');
  timestampSpan.className = 'log-timestamp';
  timestampSpan.textContent = `[${timestamp}]`;
  
  const messageSpan = document.createElement('span');
  messageSpan.className = 'log-message';
  
  // Check if message looks like JSON and format it with a monospace pre
  if (message.trim().startsWith('{') || message.trim().startsWith('[')) {
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.fontFamily = 'monospace';
    pre.style.fontSize = '12px';
    pre.textContent = message;
    messageSpan.appendChild(pre);
  } else {
    messageSpan.textContent = message;
  }
  
  entry.appendChild(timestampSpan);
  entry.appendChild(messageSpan);
  
  outputEl.appendChild(entry);
  outputEl.scrollTop = outputEl.scrollHeight;
}

// Kill Models functionality
const killModelsBtn = document.getElementById('killModelsBtn');

killModelsBtn.addEventListener('click', async () => {
  if (!confirm('Kill all running models (except router)?\n\nThis will free VRAM but any in-progress requests will fail.')) {
    return;
  }
  
  killModelsBtn.disabled = true;
  killModelsBtn.textContent = '⏳ Killing...';
  
  try {
    const response = await fetch('/v1/cleanup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      log(`✅ ${data.message}`, 'success');
      
      if (data.results && data.results.length > 0) {
        data.results.forEach(result => {
          if (result.success) {
            if (result.wasRunning === false) {
              log(`  ℹ️  ${result.name} (port ${result.port}) was not running`, 'info');
            } else {
              log(`  🗑️ Killed ${result.name} (port ${result.port})`, 'success');
            }
          } else {
            log(`  ❌ Failed to kill ${result.name} (port ${result.port}): ${result.error}`, 'error');
          }
        });
      }
      
      // Clear current model display after cleanup
      setTimeout(() => {
        currentModelEl.textContent = 'No model running';
        currentCategoryEl.textContent = '-';
      }, 500);
      
    } else {
      log(`❌ Cleanup failed: ${data.error}`, 'error');
    }
    
  } catch (error) {
    log(`❌ Error killing models: ${error.message}`, 'error');
  } finally {
    killModelsBtn.disabled = false;
    killModelsBtn.textContent = '🗑️ Kill Models';
  }
});

// Logging toggle functionality
async function loadLoggingState() {
  try {
    const response = await fetch('/v1/logging');
    const data = await response.json();
    updateLoggingUI(data.enabled);
  } catch (error) {
    console.error('Failed to load logging state:', error);
    loggingStateEl.textContent = '?';
  }
}

function updateLoggingUI(enabled) {
  loggingStateEl.textContent = enabled ? 'ON' : 'OFF';
  
  if (enabled) {
    loggingToggleBtn.classList.remove('btn-secondary');
    loggingToggleBtn.classList.add('btn-success');
  } else {
    loggingToggleBtn.classList.remove('btn-success');
    loggingToggleBtn.classList.add('btn-secondary');
  }
}

loggingToggleBtn.addEventListener('click', async () => {
  loggingToggleBtn.disabled = true;
  const originalText = loggingStateEl.textContent;
  loggingStateEl.textContent = '...';
  
  try {
    const response = await fetch('/v1/logging/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      updateLoggingUI(data.enabled);
      log(`${data.enabled ? '✅' : '🔕'} ${data.message}`, data.enabled ? 'success' : 'info');
    } else {
      log(`❌ Failed to toggle logging: ${data.error}`, 'error');
      loggingStateEl.textContent = originalText;
    }
    
  } catch (error) {
    log(`❌ Error toggling logging: ${error.message}`, 'error');
    loggingStateEl.textContent = originalText;
  } finally {
    loggingToggleBtn.disabled = false;
  }
});
