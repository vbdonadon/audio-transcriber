const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const {
  transcodeToOpus,
  segmentAudio,
  getMediaInfo,
  calculateSegmentDuration
} = require('../services/ffmpeg-service');
const {
  createWorkingDir,
  sanitizeFilename,
  cleanupWorkDir
} = require('../utils/file-utils');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create working directory for this request
    const { workDir, requestId } = createWorkingDir();
    req.workDir = workDir;
    req.requestId = requestId;
    cb(null, workDir);
  },
  filename: function (req, file, cb) {
    // Store original name and sanitized filename
    req.originalName = file.originalname;
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    cb(null, `input${ext}`);
  }
});

// File filter to validate supported media types
const fileFilter = (req, file, cb) => {
  // Accept common audio/video formats
  const allowedMimeTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'audio/mp4', 'audio/x-m4a', 'audio/webm',
    'video/mp4', 'video/webm', 'video/x-matroska'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb({
      message: `Unsupported media type: ${file.mimetype}`,
      hint: 'Supported types: MP3, WAV, M4A, MP4, WebM, MKV',
      statusCode: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE'
    }, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 2048 } // 2GB limit
});

// POST /transcode-and-split
router.post('/transcode-and-split', upload.single('file'), async (req, res, next) => {
  const startTime = Date.now();

  // If no file was uploaded
  if (!req.file) {
    return next({
      message: "Missing file field 'file' in multipart/form-data",
      hint: "Envie o upload em file=@/caminho/arquivo.ext",
      statusCode: 400,
      code: "BAD_REQUEST"
    });
  }

  try {
    // Get parameters
    const duration = parseInt(req.body.duration) || 600; // Default 10 minutes
    const bitrate = req.body.bitrate || '24k'; // Default 24kbps
    const sampleRate = parseInt(req.body.sampleRate) || 16000; // Default 16kHz
    const mode = req.body.mode || 'byDuration'; // Default by duration
    const targetMB = parseFloat(req.body.targetMB) || 10; // Default 10MB
    const cleanup = req.query.cleanup === 'true';

    // Validate parameters
    if (mode !== 'byDuration' && mode !== 'byTargetMB') {
      return next({
        message: "Invalid mode parameter. Must be 'byDuration' or 'byTargetMB'",
        hint: "Use mode=byDuration or mode=byTargetMB",
        statusCode: 400,
        code: "BAD_REQUEST"
      });
    }

    // Get file paths
    const inputPath = req.file.path;
    const { workDir, outDir } = {
      workDir: req.workDir,
      outDir: path.join(req.workDir, 'out')
    };
    const audioPath = path.join(workDir, 'audio.webm');

    console.log(`Processing file: ${inputPath}`);
    console.log(`Work directory: ${workDir}`);

    // Get input file metadata
    const fileStat = fs.statSync(inputPath);

    // 1. Transcode to Opus
    await transcodeToOpus(inputPath, audioPath, { bitrate, sampleRate });

    // 2. Determine segment time based on mode
    let segmentTime;
    if (mode === 'byDuration') {
      segmentTime = duration;
    } else {
      // Calculate segment time based on target size
      segmentTime = calculateSegmentDuration(bitrate, targetMB);
    }

    console.log(`Segment time: ${segmentTime} seconds`);

    // 3. Segment the audio
    await segmentAudio(audioPath, outDir, { segmentTime });

    // 4. List and gather metadata on output files
    const fileList = fs.readdirSync(outDir)
      .filter(file => file.startsWith('part_') && file.endsWith('.webm'))
      .sort();

    // 5. Build output file info
    const outputFiles = [];
    let totalDuration = 0;
    let totalSize = 0;

    for (const fileName of fileList) {
      const filePath = path.join(outDir, fileName);
      const stats = fs.statSync(filePath);
      let fileDuration = null;

      try {
        const mediaInfo = await getMediaInfo(filePath);
        fileDuration = mediaInfo.format.duration;
        totalDuration += fileDuration;
      } catch (error) {
        console.error(`Error getting duration for ${fileName}:`, error);
      }

      totalSize += stats.size;

      // Create a publicly accessible URL for the file
      const serverUrl = req.app.locals.serverUrl;
      const publicPath = filePath.replace(/\\/g, '/'); // Fix Windows paths
      const publicUrl = `${serverUrl}${publicPath.substring(publicPath.indexOf('/tmp'))}`;

      outputFiles.push({
        fileName,
        absPathOrUrl: publicUrl, // Use public URL
        durationSec: fileDuration,
        sizeBytes: stats.size
      });
    }

    // 6. Build response
    const response = {
      input: {
        originalName: req.originalName,
        mimeType: req.file.mimetype,
        sizeBytes: fileStat.size
      },
      settings: {
        mode,
        duration: segmentTime,
        bitrate,
        sampleRate
      },
      output: {
        codec: "libopus",
        container: "webm",
        baseDir: req.app.locals.serverUrl + outDir.substring(outDir.indexOf('/tmp')),
        files: outputFiles
      },
      stats: {
        totalParts: outputFiles.length,
        totalDurationSec: totalDuration || undefined,
        totalSizeBytes: totalSize,
        processingMs: Date.now() - startTime
      }
    };

    // Send response
    res.status(200).json(response);

    // Cleanup if requested
    if (cleanup) {
      cleanupWorkDir(workDir);
    }
  } catch (error) {
    console.error('Error processing request:', error);

    // Format error for response
    let logsSnippet = null;
    if (error.stderr) {
      logsSnippet = error.stderr.split('\n').slice(-10).join('\n');
    }

    next({
      message: `Error processing media: ${error.message || 'Unknown error'}`,
      hint: 'Verify that the input file is a valid media file',
      statusCode: 500,
      code: 'PROCESSING_ERROR',
      logsSnippet
    });

    // Always cleanup on error
    if (req.workDir) {
      cleanupWorkDir(req.workDir);
    }
  }
});

module.exports = router;
