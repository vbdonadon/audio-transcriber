const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

/**
 * Generate a unique working directory for the request
 * @returns {string} Path to the working directory
 */
function createWorkingDir() {
  const requestId = uuidv4();
  // Use os.tmpdir() for cross-platform temp directory
  const workDir = path.join(os.tmpdir(), 'audio-svc', requestId);

  // Create directories
  fs.ensureDirSync(workDir);
  fs.ensureDirSync(path.join(workDir, 'out'));

  return {
    requestId,
    workDir,
    outDir: path.join(workDir, 'out')
  };
}

/**
 * Sanitize filename for safe disk operations
 * @param {string} filename Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  // Remove special characters, spaces, accents
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .toLowerCase();
}

/**
 * Cleanup working directory
 * @param {string} workDir Directory to remove
 */
async function cleanupWorkDir(workDir) {
  try {
    await fs.remove(workDir);
    console.log(`Cleaned up: ${workDir}`);
  } catch (err) {
    console.error(`Failed to clean up ${workDir}:`, err);
  }
}

module.exports = {
  createWorkingDir,
  sanitizeFilename,
  cleanupWorkDir
};
