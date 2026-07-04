import Database from "better-sqlite3";

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('rss', 'reddit_rss', 'reddit_json', 'manual')),
      url TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS source_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES sources(id),
      external_id TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      url TEXT NOT NULL,
      author TEXT,
      published_at TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      raw_json TEXT,
      content_hash TEXT NOT NULL,
      UNIQUE(source_id, external_id),
      UNIQUE(url),
      UNIQUE(content_hash)
    );

    CREATE TABLE IF NOT EXISTS idea_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_type TEXT NOT NULL CHECK (run_type IN ('daily', 'manual', 'retry')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
      model TEXT,
      prompt_version TEXT,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER REFERENCES idea_batches(id),
      title TEXT NOT NULL,
      idea_type TEXT NOT NULL CHECK (idea_type IN ('product', 'content', 'operations')),
      context TEXT NOT NULL,
      opportunity TEXT NOT NULL,
      why_now TEXT,
      audience TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      source_item_ids TEXT NOT NULL DEFAULT '[]',
      novelty_score REAL DEFAULT 0,
      relevance_score REAL DEFAULT 0,
      duplicate_score REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'shown', 'approved', 'rejected', 'skipped', 'archived')),
      content_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      shown_at TEXT,
      decided_at TEXT
    );

    CREATE TABLE IF NOT EXISTS idea_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER NOT NULL REFERENCES ideas(id),
      action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'skipped')),
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS preference_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_type TEXT NOT NULL CHECK (signal_type IN ('tag', 'audience', 'source', 'phrase', 'category', 'idea_type')),
      signal_value TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      approved_count INTEGER NOT NULL DEFAULT 0,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(signal_type, signal_value)
    );
  `);
}
