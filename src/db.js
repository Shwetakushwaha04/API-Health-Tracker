const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Opens (and creates, if needed) the SQLite database and its tables.
// Pass ":memory:" for a throwaway database (used in tests).
function openDatabase(dbPath = process.env.DB_PATH) {
  const file = dbPath || path.join(__dirname, "..", "data", "tracker.db");

  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new Database(file);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS apis (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      url           TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'Unknown',
      status_code   INTEGER,
      response_time INTEGER,
      last_checked  TEXT,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      api_id        INTEGER NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
      checked_at    TEXT NOT NULL,
      status_code   INTEGER,
      response_time INTEGER,
      healthy       INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_apis_user ON apis(user_id);
    CREATE INDEX IF NOT EXISTS idx_checks_api ON checks(api_id, id);
  `);

  return db;
}

module.exports = { openDatabase };
