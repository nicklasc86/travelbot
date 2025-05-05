// server/config/index.js

/**
 * Centralized configuration loader & validator
 * Reads environment variables from .env (project root or server folder) and ensures required values are present.
 */
const path = require('path');
const fs = require('fs');

// Determine .env paths
const envPathRoot = path.resolve(__dirname, '..', '..', '.env');
const envPathServer = path.resolve(__dirname, '..', '.env');

// Load .env if exists
let loadedEnv = false;
if (fs.existsSync(envPathRoot)) {
  require('dotenv').config({ path: envPathRoot });
  loadedEnv = true;
} else if (fs.existsSync(envPathServer)) {
  require('dotenv').config({ path: envPathServer });
  loadedEnv = true;
}
if (!loadedEnv) {
  console.warn(`.env file not found at ${envPathRoot} or ${envPathServer}, using process.env directly.`);
}

/**
 * Helper to retrieve a required env var or throw if missing
 */
function required(name, transform = v => v) {
  const val = process.env[name];
  if (val === undefined || val === '') {
    throw new Error(`Environment variable ${name} is required but not set.`);
  }
  return transform(val);
}

module.exports = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  PINECONE_API_KEY: required('PINECONE_API_KEY'),
  PINECONE_INDEX: required('PINECONE_INDEX'),
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  // metadata confidence threshold defaults to 0.75 if not set
  METADATA_CONFIDENCE_THRESHOLD: process.env.METADATA_CONFIDENCE_THRESHOLD ? parseFloat(process.env.METADATA_CONFIDENCE_THRESHOLD) : 0.75,
};