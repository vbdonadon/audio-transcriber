const express = require('express');
const path = require('path');
const transcodeRoutes = require('./routes/transcode');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at http://localhost:${PORT}`);
  console.log(`For external access, use your machine's IP address`);
});
