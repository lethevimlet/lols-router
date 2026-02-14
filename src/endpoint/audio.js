const express = require("express");
const multer = require("multer");
const { withGpu, ensureModel, getCurrentPort } = require("../helpers/orchestrator");
const { loadModels } = require("../helpers/config");
const { fetch, FormData, File } = require("undici");
const fs = require("fs");
const path = require("path");
const os = require("os");

const router = express.Router();

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB limit (OpenAI's limit)
  },
  fileFilter: (req, file, cb) => {
    // Accept common audio formats
    const allowedMimeTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave',
      'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4',
      'audio/x-m4a', 'audio/flac', 'application/octet-stream'
    ];
    
    // Check mimetype OR file extension
    const hasValidMime = allowedMimeTypes.includes(file.mimetype);
    const hasValidExt = /\.(mp3|wav|ogg|webm|m4a|flac)$/i.test(file.originalname);
    
    if (hasValidMime || hasValidExt) {
      cb(null, true);
    } else {
      console.error(`[audio] Rejected file: ${file.originalname} (mimetype: ${file.mimetype})`);
      cb(new Error('Invalid audio file type. Supported formats: mp3, wav, ogg, webm, m4a, flac'));
    }
  }
});

router.post("/v1/audio/transcriptions", upload.single('file'), async (req, res) => {
  const rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const t0 = Date.now();

  function log() {
    if (!global.ENABLE_LOGGING) return;
    const args = Array.from(arguments);
    console.log("[audio]", rid, "t+" + (Date.now() - t0) + "ms", ...args);
    
    // Broadcast to WebSocket clients
    if (global.broadcastLog) {
      global.broadcastLog("audio", rid, "t+" + (Date.now() - t0) + "ms", ...args);
    }
  }

  let tempFilePath = null;

  try {
    log("transcription request received");

    // Check if file was uploaded
    if (!req.file) {
      log("error: no file uploaded");
      return res.status(400).json({
        error: {
          message: "No audio file provided. Please include a 'file' field in your multipart/form-data request.",
          type: "invalid_request_error"
        }
      });
    }

    log("file received:", req.file.originalname, `(${(req.file.size / 1024).toFixed(1)} KB)`);

    // Get model from request (default to whisper-small)
    const modelName = req.body.model || "whisper-small";
    log("requested model:", modelName);

    // Get model config
    const modelsConfig = loadModels();
    const models = modelsConfig.models || {};
    const modelConfig = models[modelName];

    if (!modelConfig) {
      log("error: unknown model");
      return res.status(400).json({
        error: {
          message: `Unknown model: ${modelName}`,
          type: "invalid_request_error"
        }
      });
    }

    if (modelConfig.type !== "whisper-cpp") {
      log("error: not a whisper model");
      return res.status(400).json({
        error: {
          message: `Model ${modelName} is not a whisper model. Please use a model with type "whisper-cpp".`,
          type: "invalid_request_error"
        }
      });
    }

    // Ensure whisper model is loaded (GPU orchestration)
    log("ensuring whisper model is loaded...");
    await withGpu(async () => {
      await ensureModel(modelName, modelConfig);
    });

    const port = getCurrentPort();
    log("whisper model ready on port:", port);

    // Save uploaded file temporarily (whisper-server needs a file path)
    tempFilePath = path.join(os.tmpdir(), `whisper-${rid}-${req.file.originalname}`);
    fs.writeFileSync(tempFilePath, req.file.buffer);
    log("saved temp file:", tempFilePath);

    // Prepare form data for whisper-server
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(tempFilePath);
    formData.append('file', new File([fileBuffer], req.file.originalname, { type: req.file.mimetype }));

    // Add optional parameters
    if (req.body.language) {
      formData.append('language', req.body.language);
    }
    if (req.body.prompt) {
      formData.append('prompt', req.body.prompt);
    }
    if (req.body.temperature) {
      formData.append('temperature', req.body.temperature);
    }

    // Forward to whisper-server
    const upstreamUrl = `http://127.0.0.1:${port}/inference`;
    log("forwarding to whisper-server:", upstreamUrl);

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      body: formData
    });

    log("whisper-server response status:", upstream.status);

    if (!upstream.ok) {
      const errorText = await upstream.text();
      log("whisper-server error:", errorText);
      return res.status(upstream.status).json({
        error: {
          message: `Whisper server error: ${errorText}`,
          type: "server_error"
        }
      });
    }

    const result = await upstream.json();
    log("transcription complete");

    // Format response to match OpenAI API
    const response = {
      text: result.text || ""
    };

    // Add optional fields if requested
    if (req.body.response_format === "verbose_json") {
      response.language = result.language || "unknown";
      response.duration = result.duration || 0;
      response.segments = result.segments || [];
    }

    res.json(response);
    log("response sent");

  } catch (error) {
    log("error:", error.message);
    res.status(500).json({
      error: {
        message: error.message || String(error),
        type: "server_error"
      }
    });
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        log("cleaned up temp file");
      } catch (err) {
        log("warning: failed to clean up temp file:", err.message);
      }
    }
  }
});

// Error handling middleware for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    console.error("[audio] Multer error:", err.message);
    return res.status(400).json({
      error: {
        message: err.message,
        type: "invalid_request_error"
      }
    });
  } else if (err) {
    // Other errors (like file filter rejections)
    console.error("[audio] Upload error:", err.message);
    return res.status(400).json({
      error: {
        message: err.message || "Invalid file upload",
        type: "invalid_request_error"
      }
    });
  }
  next();
});

module.exports = router;
