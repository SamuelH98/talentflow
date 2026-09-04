import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function dbPath() {
  return process.env.DB_PATH || path.join(dataDir, 'talentflow.db');
}

export function createDb(dbFile) {
  const db = new Database(dbFile || dbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'recruiter',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      location TEXT,
      title TEXT,
      summary TEXT,
      years_experience REAL NOT NULL DEFAULT 0,
      skills TEXT NOT NULL DEFAULT '[]',
      experience TEXT NOT NULL DEFAULT '[]',
      education TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      resume_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      title TEXT NOT NULL,
      department TEXT,
      location TEXT,
      description TEXT,
      requirements TEXT NOT NULL DEFAULT '[]',
      skills TEXT NOT NULL DEFAULT '[]',
      years_required REAL NOT NULL DEFAULT 0,
      min_salary INTEGER,
      max_salary INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      score REAL,
      status TEXT NOT NULL DEFAULT 'matched',
      notes TEXT,
      tracking_token TEXT UNIQUE,
      status_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(job_id, candidate_id)
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_company ON candidates(company_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
    CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
  `);

  const cols = db.prepare(`PRAGMA table_info(applications)`).all().map((c) => c.name);
  if (!cols.includes('tracking_token')) {
    db.exec(`ALTER TABLE applications ADD COLUMN tracking_token TEXT UNIQUE`);
  }
  if (!cols.includes('status_updated_at')) {
    db.exec(`ALTER TABLE applications ADD COLUMN status_updated_at TEXT`);
  }
  db.exec(`
    UPDATE applications SET status_updated_at = created_at WHERE status_updated_at IS NULL;
  `);

  return db;
}

export function getDb() {
  return createDb(dbPath());
}