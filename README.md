# Audio Transcriber API

API for transcoding and splitting audio/video files. This API extracts audio from media files, re-encodes it to Opus mono 16kHz, and splits it into smaller parts for further processing.

## Features

- Convert any audio or video file to Opus mono 16kHz
- Split audio into smaller segments by duration or target file size
- Get detailed metadata about the processed files
- Support for cleanup of temporary files

## Installation

```bash
# Clone repository
git clone <repository-url>
cd audio-transcriber

# Install dependencies
npm install
```

## Usage

Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Reference

### POST /transcode-and-split

Transcodes an audio or video file to Opus mono and splits it into smaller segments.

#### Request

- **Content-Type:** `multipart/form-data`
- **Body:**
  - `file` (required): The audio or video file to process
  - `duration` (optional): Segment duration in seconds (default: 600)
  - `bitrate` (optional): Audio bitrate for Opus encoding (default: '24k')
  - `sampleRate` (optional): Audio sample rate in Hz (default: 16000)
  - `mode` (optional): Segmentation mode, either 'byDuration' or 'byTargetMB' (default: 'byDuration')
  - `targetMB` (optional): Target segment size in MB, used when mode='byTargetMB' (default: 10)
- **Query Parameters:**
  - `cleanup` (optional): Whether to remove temporary files after processing (default: false)

#### Response

```json
{
  "input": {
    "originalName": "video.mp4",
    "mimeType": "video/mp4",
    "sizeBytes": 73400320
  },
  "settings": {
    "mode": "byDuration",
    "duration": 600,
    "bitrate": "24k",
    "sampleRate": 16000
  },
  "output": {
    "codec": "libopus",
    "container": "webm",
    "baseDir": "/tmp/audio-svc/3f2e8c01/out",
    "files": [
      {
        "fileName": "part_000.webm",
        "absPathOrUrl": "/tmp/audio-svc/3f2e8c01/out/part_000.webm",
        "durationSec": 600,
        "sizeBytes": 2457600
      }
    ]
  },
  "stats": {
    "totalParts": 1,
    "totalDurationSec": 600,
    "totalSizeBytes": 2457600,
    "processingMs": 4180
  }
}
```

## Examples

### Split by duration (default)

```bash
curl -X POST http://localhost:3000/transcode-and-split \
  -F "file=@/path/to/video.mp4" \
  -F "duration=600" \
  -F "bitrate=24k" \
  -F "sampleRate=16000"
```

### Split by target size

```bash
curl -X POST http://localhost:3000/transcode-and-split \
  -F "file=@/path/to/audio.wav" \
  -F "mode=byTargetMB" \
  -F "targetMB=23" \
  -F "bitrate=24k"
```

### With cleanup enabled

```bash
curl -X POST "http://localhost:3000/transcode-and-split?cleanup=true" \
  -F "file=@/path/to/audio.mp3"
```

## Supported File Formats

- Audio: MP3, WAV, M4A, WebM
- Video: MP4, WebM, MKV

## Technical Notes

- Uses FFmpeg for audio processing (provided by ffmpeg-static)
- Temporary files are stored in system temp directory
- Each request gets a unique UUID for isolation
