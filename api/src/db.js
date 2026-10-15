const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      google_sub  TEXT UNIQUE,
      created_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  INTEGER NOT NULL,
      last_used   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS login_codes (
      email       TEXT PRIMARY KEY,
      code_hash   TEXT NOT NULL,
      link_hash   TEXT NOT NULL UNIQUE,
      expires_at  INTEGER NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_data (
      user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      rev         INTEGER NOT NULL,
      data        TEXT NOT NULL,
      updated_at  INTEGER NOT NULL
    );
  `);

  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userByGoogle: db.prepare('SELECT * FROM users WHERE google_sub = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (email, google_sub, created_at) VALUES (?, ?, ?)'),
    setGoogleSub: db.prepare('UPDATE users SET google_sub = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_used) VALUES (?, ?, ?, ?)'),
    session: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
    touchSession: db.prepare('UPDATE sessions SET last_used = ? WHERE token_hash = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    pruneSessions: db.prepare('DELETE FROM sessions WHERE last_used < ?'),

    upsertCode: db.prepare(`INSERT INTO login_codes (email, code_hash, link_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, link_hash = excluded.link_hash, expires_at = excluded.expires_at, attempts = 0`),
    codeByEmail: db.prepare('SELECT * FROM login_codes WHERE email = ?'),
    codeByLink: db.prepare('SELECT * FROM login_codes WHERE link_hash = ?'),
    countAttempt: db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?'),
    deleteCode: db.prepare('DELETE FROM login_codes WHERE email = ?'),
    pruneCodes: db.prepare('DELETE FROM login_codes WHERE expires_at < ?'),

    data: db.prepare('SELECT rev, data, updated_at FROM user_data WHERE user_id = ?'),
    insertData: db.prepare('INSERT INTO user_data (user_id, rev, data, updated_at) VALUES (?, 1, ?, ?)'),
    updateData: db.prepare('UPDATE user_data SET rev = rev + 1, data = ?, updated_at = ? WHERE user_id = ? AND rev = ?'),
  };

  return { db, q };
}

module.exports = { openDb };
