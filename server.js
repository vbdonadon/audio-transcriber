const express = require('express');
const path = require('path');
const os = require('os');
const transcodeRoutes = require('./routes/transcode');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve temporary files - make audio files accessible
app.use('/tmp', express.static(os.tmpdir()));

// Routes
app.use('/', transcodeRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);

  const statusCode = err.statusCode || 500;
  const response = {
    error: err.message || 'Internal Server Error',
    hint: err.hint || 'Contact the system administrator',
    code: err.code || 'SERVER_ERROR',
    logsSnippet: err.logsSnippet
  };

  res.status(statusCode).json(response);
});

// Define server URL (for public access to files)
const SERVER_URL = process.env.SERVER_URL || 'https://audio-transcriber-rlqi.onrender.com';
app.locals.serverUrl = SERVER_URL;

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at http://localhost:${PORT}`);
  console.log(`Public server URL: ${SERVER_URL}`);
});
