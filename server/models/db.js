// server/models/db.js

/**
 * SQLite database initialization and helper functions
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to SQLite file (review.db in project root)
const dbPath = path.resolve(__dirname, '../..', 'review.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) console.error('❌ SQLite open error:', err);
  else console.log('✅ Connected to SQLite at', dbPath);
});

// Create tables if they don't exist
const initReviewTable = `
CREATE TABLE IF NOT EXISTS review_tips (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  city TEXT,
  country TEXT,
  confidence REAL,
  moderation TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;
const initApprovedTable = `
CREATE TABLE IF NOT EXISTS approved_tips (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  city TEXT,
  country TEXT,
  confidence REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

db.serialize(() => {
  db.run(initReviewTable, err => {
    if (err) console.error('❌ Create review_tips table error:', err);
  });
  db.run(initApprovedTable, err => {
    if (err) console.error('❌ Create approved_tips table error:', err);
  });
});

// Promisified helpers
module.exports = {
  run: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    }),
  get: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
  all: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
  // expose raw db if needed
  _db: db
};
