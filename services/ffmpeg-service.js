const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const fs = require('fs-extra');

// Configure ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Transcode audio/video to mono Opus 16kHz
 * @param {string} inputPath Path to input file
 * @param {string} outputPath Path for output file
 * @param {object} options Transcoding options
 * @returns {Promise} Promise resolved when transcoding is complete
 */
function transcodeToOpus(inputPath, outputPath, options) {
  const { bitrate = '24k', sampleRate = 16000 } = options;

  return new Promise((resolve, reject) => {
    console.log(`[DEBUG] Transcoding command: ffmpeg -y -i ${inputPath} -vn -ac 1 -ar ${sampleRate} -c:a libopus -b:a ${bitrate} ${outputPath}`);

    ffmpeg(inputPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(sampleRate)
      .audioCodec('libopus')
      .audioBitrate(bitrate)
      .output(outputPath)
      .on('start', (cmdline) => {
        console.log('Started ffmpeg with command:', cmdline);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Error:', err);
        console.error('ffmpeg stderr:', stderr);
        reject({
          error: err,
          stderr,
          stdout
        });
      })
      .on('end', () => {
        console.log('Transcoding finished');
        resolve();
      })
      .run();
  });
}

/**
 * Split audio file into segments
 * @param {string} inputPath Path to input audio file
 * @param {string} outputDir Directory for output segments
 * @param {object} options Segmentation options
 * @returns {Promise} Promise resolved when segmentation is complete
 */
function segmentAudio(inputPath, outputDir, options) {
  const { segmentTime } = options;
  const outputPattern = path.join(outputDir, 'part_%03d.webm');

  return new Promise((resolve, reject) => {
    console.log(`[DEBUG] Segment command: ffmpeg -y -i ${inputPath} -f segment -segment_time ${segmentTime} -c copy ${outputPattern}`);

    ffmpeg(inputPath)
      .outputOptions([
        '-f segment',
        `-segment_time ${segmentTime}`,
        '-c copy'
      ])
      .output(outputPattern)
      .on('start', (cmdline) => {
        console.log('Started ffmpeg segmentation with command:', cmdline);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Error:', err);
        console.error('ffmpeg stderr:', stderr);
        reject({
          error: err,
          stderr,
          stdout
        });
      })
      .on('end', () => {
        console.log('Segmentation finished');
        resolve();
      })
      .run();
  });
}

/**
 * Get media file metadata using ffprobe
 * @param {string} filePath Path to media file
 * @returns {Promise<object>} Promise resolved with file metadata
 */
function getMediaInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      resolve(metadata);
    });
  });
}

/**
 * Calculate segment duration for target file size
 * @param {string} bitrate Bitrate string (e.g., '24k')
 * @param {number} targetMB Target size in MB
 * @returns {number} Segment duration in seconds
 */
function calculateSegmentDuration(bitrate, targetMB) {
  // Extract numeric part from bitrate string (e.g., '24k' -> 24)
  const bitrateKbps = parseInt(bitrate);

  if (isNaN(bitrateKbps)) {
    throw new Error(`Invalid bitrate format: ${bitrate}`);
  }

  // Calculate max seconds using formula: floor((targetMB * 8192) / bitrateKbps)
  // 8192 = 1024 (KB per MB) * 8 (bits per byte)
  const maxSeconds = Math.floor((targetMB * 8192) / bitrateKbps);

  return maxSeconds;
}

module.exports = {
  transcodeToOpus,
  segmentAudio,
  getMediaInfo,
  calculateSegmentDuration
};
