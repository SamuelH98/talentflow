import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const defaultUploadsDir = path.join(dataDir, 'uploads');

// Resolved at request time so it honors the configured env at the moment a
// write happens (tests / containers can point it anywhere).
export function resolveUploadsDir() {
  return process.env.UPLOADS_DIR || defaultUploadsDir;
}

function ensureUploadsDir() {
  const dir = resolveUploadsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Legacy static alias (module-load-time) for code that uses it at import time.
export const uploadsDir = defaultUploadsDir;
ensureUploadsDir();

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
      resume_filename TEXT,
      resume_path TEXT,
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

    CREATE TABLE IF NOT EXISTS application_answers (
      application_id INTEGER PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_log(company_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

    CREATE TABLE IF NOT EXISTS screening_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      label TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'text',
      options TEXT NOT NULL DEFAULT '[]',
      default_enabled INTEGER NOT NULL DEFAULT 1,
      default_required INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_screening_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES screening_questions(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      required INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(job_id, question_id)
    );

    CREATE INDEX IF NOT EXISTS idx_screening_company ON screening_questions(company_id);
    CREATE INDEX IF NOT EXISTS idx_job_screening_job ON job_screening_questions(job_id);
  `);

  const candCols = db.prepare(`PRAGMA table_info(candidates)`).all().map((c) => c.name);
  if (!candCols.includes('resume_filename')) {
    db.exec(`ALTER TABLE candidates ADD COLUMN resume_filename TEXT`);
  }
  if (!candCols.includes('resume_path')) {
    db.exec(`ALTER TABLE candidates ADD COLUMN resume_path TEXT`);
  }

  const cols = db.prepare(`PRAGMA table_info(applications)`).all().map((c) => c.name);
  if (!cols.includes('tracking_token')) {
    db.exec(`ALTER TABLE applications ADD COLUMN tracking_token TEXT UNIQUE`);
  }
  if (!cols.includes('status_updated_at')) {
    db.exec(`ALTER TABLE applications ADD COLUMN status_updated_at TEXT`);
  }
  // Applicant consent tracking (privacy milestone). Introduced after v0.1.0;
  // pre-policy rows get a synthetic consent record so the migration stays safe.
  const hasConsent = db.prepare(`PRAGMA table_info(applications)`).all().map((c) => c.name);
  if (!hasConsent.includes('consented_at')) {
    db.exec(`ALTER TABLE applications ADD COLUMN consented_at TEXT`);
  }
  if (!hasConsent.includes('policy_version')) {
    db.exec(`ALTER TABLE applications ADD COLUMN policy_version TEXT`);
  }
  db.exec(`
    UPDATE applications SET consented_at = created_at WHERE consented_at IS NULL;
    UPDATE applications SET policy_version = '2026-09-01' WHERE policy_version IS NULL;
  `);

  return db;
}

export function getDb() {
  return createDb(dbPath());
}