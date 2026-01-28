import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV === 'development';
const resourcesPath = (process as any).resourcesPath;

const getAppDataPath = () => {
  if (process.env.APPDATA) return process.env.APPDATA;
  if (process.platform === 'darwin') {
    return path.join(process.env.HOME || '', 'Library/Application Support');
  }
  return path.join(process.env.HOME || '', '.config');
};

const DB_PATH = (isDev || !resourcesPath)
  ? path.join(__dirname, '../../data/chess.db')
  : path.join(getAppDataPath(), 'chess-analytics', 'chess.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  // Ensure data directory exists
  const fs = await import('fs');
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Games table
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      pgn TEXT NOT NULL,
      white_player TEXT,
      black_player TEXT,
      user_color TEXT,
      result TEXT,
      time_control TEXT,
      opening_eco TEXT,
      opening_name TEXT,
      played_at TEXT,
      imported_at TEXT DEFAULT (datetime('now')),
      analyzed INTEGER DEFAULT 0
    );

    -- Analysis results
    CREATE TABLE IF NOT EXISTS analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
      move_number INTEGER,
      ply INTEGER,
      fen TEXT,
      move_played TEXT,
      best_move TEXT,
      eval_before REAL,
      eval_after REAL,
      cp_loss REAL,
      classification TEXT,
      is_user_move INTEGER,
      UNIQUE(game_id, ply)
    );

    -- Insights cache
    CREATE TABLE IF NOT EXISTS insights_cache (
      key TEXT PRIMARY KEY,
      data TEXT,
      computed_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_games_source ON games(source);
    CREATE INDEX IF NOT EXISTS idx_games_opening ON games(opening_eco);
    CREATE INDEX IF NOT EXISTS idx_games_analyzed ON games(analyzed);
    CREATE INDEX IF NOT EXISTS idx_analysis_game ON analysis(game_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_classification ON analysis(classification);
  `);

  console.log('✅ Database initialized at', DB_PATH);
}
