# Image Handling & Storage

> **TL;DR**: Images are **never persisted to disk** by lols-router. They are processed in memory and immediately discarded after the response is generated.

---

## 🖼️ How Images Are Processed

### Client → Server Flow

```
┌─────────────┐
│   Browser   │
│  (Web UI)   │
└──────┬──────┘
       │ 1. User selects image file
       │ 2. JavaScript converts to base64 (in browser memory)
       │ 3. Sends JSON with base64 image data
       ▼
┌─────────────┐
│ lols-router │
│   Server    │
└──────┬──────┘
       │ 4. Receives JSON request (image in memory)
       │ 5. Passes to llama-server (still in memory)
       │ 6. Processes image with vision model (VRAM)
       │ 7. Generates response
       │ 8. Returns response
       │ 9. Discards image data (garbage collected)
       ▼
┌─────────────┐
│   Browser   │
│  (Web UI)   │
└─────────────┘
       10. Displays response
       11. Image cleared from preview (if user clicks Clear)
```

### Key Points

✅ **No file uploads** - Images never leave the browser as files  
✅ **No disk writes** - Server never writes images to disk  
✅ **Memory only** - Images exist in RAM briefly during processing  
✅ **Auto cleanup** - JavaScript garbage collection handles memory  
✅ **No persistence** - Images cannot be recovered after response  

---

## 📁 What Gets Stored?

### Never Stored
- ❌ Uploaded images
- ❌ Image thumbnails
- ❌ Image metadata (EXIF)
- ❌ Vision model responses with images
- ❌ Request history with images

### Temporarily Created (Auto-Deleted)
- ⚠️ **Test temp files** (only during integration tests)
  - Location: `os.tmpdir()` (e.g., `/tmp/` on Linux)
  - Pattern: `curl-body-*.json`
  - Lifespan: Created during test, deleted immediately after
  - Cleanup: Automatic in `finally` block + periodic cleanup every 30 min

### Permanently Stored
- ✅ **Test image** (`test/test.jpg`)
  - Purpose: Sample image for integration tests
  - Size: 115 KB (cat photo)
  - Usage: Loaded by tests, converted to base64, never uploaded
  - Location: Repository test directory

- ✅ **Logs** (if logging enabled)
  - Content: Request metadata, model selection, timing
  - Does NOT include: Image data, base64 strings
  - Location: Console output (not file by default)

---

## 🧹 Automatic Cleanup

### Integration Test Cleanup

**File:** `test/integration-test.js`

```javascript
async function curlRequest(endpoint, options = {}) {
  let tempFile = null;
  
  try {
    // Create temp file if body > 50KB
    if (bodyStr.length > 50000) {
      tempFile = path.join(os.tmpdir(), `curl-body-${Date.now()}.json`);
      fs.writeFileSync(tempFile, bodyStr);
      curlCmd += ` --data-binary @${tempFile}`;
    }
    
    // Execute request...
  } finally {
    // Clean up temp file IMMEDIATELY
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}
```

✅ **Guaranteed cleanup** via `finally` block  
✅ **Immediate deletion** after request completes  
✅ **No orphaned files** even if request fails  

### Periodic Temp File Cleanup

**File:** `src/helpers/temp-cleanup.js`

Automatically runs on server startup and every 30 minutes:

```javascript
// Scans system temp directory
// Removes curl-body-*.json files older than 60 minutes
// Safe: Only removes files matching our patterns
```

**Configuration:**
- **Interval**: Every 30 minutes
- **Max Age**: 60 minutes
- **Patterns**: `curl-body-*.json` (test files only)
- **Location**: System temp directory (`os.tmpdir()`)

**Logging:**
```
[temp-cleanup] Periodic cleanup started (every 30min, max age 60min)
[temp-cleanup] Cleaned 3 old temp file(s) (age > 60min)
```

---

## 🔒 Security & Privacy

### Data Retention
- **Images**: Never stored, processed in memory only
- **Conversations**: Not logged or stored (unless you explicitly add logging)
- **Base64 data**: Not written to disk
- **Model responses**: Returned immediately, not cached

### Privacy Benefits
- ✅ **GDPR compliant** - No personal data retention
- ✅ **No data leaks** - Images cannot be recovered
- ✅ **Zero persistence** - Server restart clears all memory
- ✅ **No tracking** - No image metadata collected

### Recommendations
- If you need image retention, implement it client-side (browser storage)
- If logging is enabled, ensure logs are rotated and cleaned
- For production, review your log output to ensure no PII is logged

---

## 🧪 Testing Considerations

### Test Images
**Location:** `test/test.jpg` (115 KB)
- Used by integration tests
- Loaded from disk, converted to base64, sent as JSON
- Never uploaded as file

### Running Tests
```bash
# Integration tests (creates temp files briefly)
npm run test:integration

# Temp files are cleaned up automatically
# Manual cleanup (if needed):
node -e "require('./src/helpers/temp-cleanup').cleanupOldTempFiles(0)"
```

### Temp File Location
```bash
# Linux/Mac
/tmp/curl-body-*.json

# Windows
%TEMP%\curl-body-*.json
```

---

## 📊 Storage Requirements

### Server
- **Runtime memory**: ~100-200 MB (base)
- **Per image request**: +5-50 MB (during processing)
- **VRAM usage**: +1-2 GB (vision model loaded)
- **Disk usage**: 0 bytes (images never stored)

### Client (Browser)
- **Image preview**: Stored in browser memory
- **Base64 data**: Stored in JavaScript variable
- **Cleared when**: User clicks "Clear Image" or reloads page

---

## ❓ FAQ

### Q: Where are uploaded images stored?
**A:** Nowhere. Images are converted to base64 in the browser and sent as JSON. The server processes them in memory and immediately discards them.

### Q: How long are images retained?
**A:** Images exist in memory only during the HTTP request/response cycle (~1-10 seconds). They are garbage collected immediately after.

### Q: Can I recover a previously uploaded image?
**A:** No. Images are not stored anywhere on the server or client (unless you save them yourself).

### Q: What if the server crashes during image processing?
**A:** The image data is lost. It only exists in RAM during processing.

### Q: Do test files accumulate over time?
**A:** No. Integration tests clean up temp files immediately via `finally` blocks. Additionally, periodic cleanup runs every 30 minutes to remove any orphaned files older than 60 minutes.

### Q: Can I disable temp file cleanup?
**A:** Yes, but not recommended. Comment out `startPeriodicCleanup()` in `src/server.js` if needed.

### Q: How do I manually trigger cleanup?
**A:** 
```javascript
const { cleanupOldTempFiles } = require('./src/helpers/temp-cleanup');
cleanupOldTempFiles(0); // Clean all matching temp files
```

### Q: Are images logged?
**A:** No. Logs contain request metadata (model, timing, category) but never include image data or base64 strings.

### Q: What about VRAM usage?
**A:** Vision model uses ~6 GB VRAM when loaded. Use the "Kill Models" button or `/v1/cleanup` endpoint to free VRAM between sessions.

---

## 🛠️ Implementation Details

### Web Interface (`src/webapp/script.js`)

```javascript
// Image stored in browser memory only
let uploadedImage = null; // base64 data URL

// When user uploads image
reader.onload = (e) => {
  uploadedImage = e.target.result; // Store in memory
  // Display preview
};

// When user clears image
function clearImage() {
  uploadedImage = null; // Clear from memory
  imageInput.value = '';
  imagePreview.innerHTML = '';
}
```

### Chat Endpoint (`src/endpoint/chat.js`)

```javascript
// Receives image as part of JSON payload
const payload = { ...req.body };
// req.body.messages[].content[] may contain image_url with base64 data

// Passes to llama-server (still in memory)
const upstream = await fetch(upstreamUrl, {
  method: "POST",
  body: JSON.stringify(payload), // Image still in JSON
  // ...
});

// After response, payload is garbage collected
// Image data is never written to disk
```

### Vision Model Processing (llama-server)

```bash
# llama-server processes images in VRAM
# Images are decoded from base64 and processed
# Results returned to lols-router
# Image data discarded by llama-server after response
```

---

## 📚 Related Documentation

- [VISION_SUMMARY.md](VISION_SUMMARY.md) - Vision model setup and usage
- [API_REFERENCE.md](API_REFERENCE.md) - API endpoints and request format
- [EXAMPLES.md](EXAMPLES.md) - Vision request examples with images
- [test/README.md](../test/README.md) - Testing documentation

---

## 🔍 Verification

To verify no images are stored:

```bash
# Check for image files in project
find . -type f \( -iname "*.jpg" -o -iname "*.png" -o -iname "*.jpeg" \) | grep -v node_modules

# Should only show:
# ./test/test.jpg (test image)
# ./docs/gui.png (screenshot for README)

# Check system temp directory for orphaned test files
ls -lh /tmp/curl-body-*.json

# Should be empty or show only very recent files (< 60 min old)
```

---

<div align="center">

**Your images are safe and private. They're processed instantly and never stored.** 🔒✨

[🏠 Back to Docs](README.md) • [👁️ Vision Summary](VISION_SUMMARY.md) • [📡 API Reference](API_REFERENCE.md)

</div>
