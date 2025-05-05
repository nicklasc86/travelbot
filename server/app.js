// server/app.js

/**
 * Main Express server wiring up route modules
 */

// 1) Config & Environment
const { PORT } = require('./config/index.js');

// 2) Imports
const express = require('express');
const http = require('http');
const cors = require('cors');

// 3) Route modules
const ingestRoutes = require('./routes/ingestRoutes');
const askRoutes    = require('./routes/askRoutes');
const adminRoutes  = require('./routes/adminRoutes');

// 4) Express app setup
const app = express();
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// 5) Mount routes
app.use('/ingest', ingestRoutes);
app.use('/ask',    askRoutes);
app.use('/admin',  adminRoutes);

// 6) Start HTTP server
const server = http.createServer(
  { maxHeaderSize: 32768 },
  app
);
const basePort = PORT;

function listen(port) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`🚀 Server listening on http://localhost:${port}`);
  });
}

// If we get EADDRINUSE, try the next port
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Port ${basePort} in use, trying ${basePort + 1}...`);
    listen(basePort + 1);
  } else {
    // Let other errors bubble up
    throw err;
  }
});

// First attempt
listen(basePort);