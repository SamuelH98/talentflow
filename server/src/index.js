import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { getDb, getUploadsDir, resolveUploadsDir } from './db.js';
import { requireAuth, requireAdmin, signToken, logAudit } from './auth.js';
import { scoreCandidate, rankCandidates, parseSkills } from './matching.js';
import { readResume, UnsupportedResumeError } from './resume.js';
import { QUESTIONNAIRE, questionnairePublic } from './questionnaire.js';
import { seed } from './seed.js';
import { POLICY_VERSION, PRIVACY_NOTICE } from './privacy.js';
import { sampleBrandColor } from './branding.js';
import {
  effectiveQuestions,
  getLibrary,
  jobConfig,
  sanitizeScreeningAnswers,
  saveJobQuestionConfig,
  screeningAnswersForApplication,
  ScreenQuestionValidation,
  validateQuestionInput,
} from './screening.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');

const RESUME_EXT = ['pdf', 'docx', 'txt'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = String((file.originalname || '').split('.').pop() || '').toLowerCase();
    if (RESUME_EXT.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported file type. Use .pdf, .docx, or .txt'));
  },
});

const LOGO_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'];
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = String((file.originalname || '').split('.').pop() || '').toLowerCase();
    if (LOGO_EXT.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported logo type. Use .png, .jpg, .jpeg, .gif, .webp, .svg, or .avif'));
  },
});

const PUBLIC_STAGES = ['matched', 'in_review', 'interview', 'hired'];

function getDefaultCompany(db) {
  return db.prepare('SELECT * FROM companies ORDER BY id LIMIT 1').get();
}

function scrubJob(job) {
  if (!job) return job;
  const { company_id, status, ...rest } = job;
  return { ...rest };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id);
  logAudit({ user, db, action: 'auth.login', detail: 'Recruiter signed in' });
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, company } });
});

app.get('/api/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, company_id FROM users WHERE id = ?').get(req.user.id);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id);
  res.json({ user: { ...user, company } });
});

// ---------- Candidates ----------

function candidateRow(row) {
  if (!row) return row;
  return {
    ...row,
    skills: parseSkills(row.skills),
    experience: parseSkills(row.experience),
    education: parseSkills(row.education),
  };
}

app.get('/api/candidates', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM candidates WHERE company_id = ? ORDER BY created_at DESC')
    .all(req.user.company_id);
  res.json(rows.map(candidateRow));
});

app.get('/api/candidates/:id', requireAuth, (req, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM candidates WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.company_id);
  if (!row) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidateRow(row));
});

app.post('/api/candidates', requireAuth, (req, res) => {
  const db = getDb();
  const { name, email, phone, location, title, summary, years_experience, skills, experience, education, resume_text } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const info = db
    .prepare(
      `INSERT INTO candidates (company_id, name, email, phone, location, title, summary, years_experience, skills, experience, education, resume_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.company_id,
      name,
      email || null,
      phone || null,
      location || null,
      title || null,
      summary || null,
      years_experience || 0,
      JSON.stringify(skills || []),
      JSON.stringify(experience || []),
      JSON.stringify(education || []),
      resume_text || null
    );
  res.status(201).json(candidateRow(db.prepare('SELECT * FROM candidates WHERE id = ?').get(info.lastInsertRowid)));
  logAudit({ user: req.user, db, action: 'candidate.create', detail: `${name} <${email || ''}>` });
});

app.put('/api/candidates/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM candidates WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.company_id);
  if (!existing) return res.status(404).json({ error: 'Candidate not found' });

  const b = { ...existing, ...req.body, skills: req.body.skills ?? existing.skills, experience: req.body.experience ?? existing.experience, education: req.body.education ?? existing.education };
  db.prepare(
    `UPDATE candidates SET name = ?, email = ?, phone = ?, location = ?, title = ?, summary = ?, years_experience = ?, skills = ?, experience = ?, education = ?, resume_text = ?, status = ? WHERE id = ?`
  ).run(
    b.name, b.email, b.phone, b.location, b.title, b.summary,
    Number(b.years_experience) || 0,
    JSON.stringify(parseSkills(b.skills)),
    JSON.stringify(parseSkills(b.experience)),
    JSON.stringify(parseSkills(b.education)),
    b.resume_text, b.status, req.params.id
  );
  res.json(candidateRow(db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id)));
  logAudit({ user: req.user, db, action: 'candidate.update', detail: `${existing.name} (#${existing.id})` });
});

app.delete('/api/candidates/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT name FROM candidates WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  const info = db.prepare('DELETE FROM candidates WHERE id = ? AND company_id = ?').run(req.params.id, req.user.company_id);
  if (!info.changes) return res.status(404).json({ error: 'Candidate not found' });
  logAudit({ user: req.user, db, action: 'candidate.delete', detail: `${existing?.name || req.params.id} (#${req.params.id})` });
  res.json({ ok: true });
});

app.get('/api/candidates/:id/resume', requireAuth, (req, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT id, resume_path, resume_filename, name FROM candidates WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.company_id);
  if (!row || !row.resume_path) return res.status(404).json({ error: 'No resume on file for this candidate' });
  const file = path.join(resolveUploadsDir(), path.basename(row.resume_path));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Resume file is missing' });
  logAudit({ user: req.user, db, action: 'candidate.resume_download', detail: `${row.name} (#${row.id})` });
  res.download(file, row.resume_filename || path.basename(file));
});

// ---------- Jobs ----------

function jobRow(row) {
  if (!row) return row;
  return { ...row, requirements: parseSkills(row.requirements), skills: parseSkills(row.skills) };
}

app.get('/api/jobs', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM jobs WHERE company_id = ? ORDER BY created_at DESC').all(req.user.company_id);
  res.json(rows.map(jobRow));
});

app.get('/api/jobs/:id', requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!row) return res.status(404).json({ error: 'Job not found' });
  res.json(jobRow(row));
});

app.post('/api/jobs', requireAuth, (req, res) => {
  const db = getDb();
  const { title, department, location, description, requirements, skills, years_required, min_salary, max_salary } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const info = db
    .prepare(
      `INSERT INTO jobs (company_id, title, department, location, description, requirements, skills, years_required, min_salary, max_salary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.company_id, title, department || null, location || null, description || null,
      JSON.stringify(requirements || []), JSON.stringify(skills || []),
      Number(years_required) || 0, min_salary || null, max_salary || null
    );
  res.status(201).json(jobRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(info.lastInsertRowid)));
  logAudit({ user: req.user, db, action: 'job.create', detail: `${title} (#${info.lastInsertRowid})` });
});

app.put('/api/jobs/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });
  const b = { ...existing, ...req.body, requirements: req.body.requirements ?? existing.requirements, skills: req.body.skills ?? existing.skills };
  db.prepare(
    `UPDATE jobs SET title = ?, department = ?, location = ?, description = ?, requirements = ?, skills = ?, years_required = ?, min_salary = ?, max_salary = ?, status = ? WHERE id = ?`
  ).run(
    b.title, b.department, b.location, b.description,
    JSON.stringify(parseSkills(b.requirements)), JSON.stringify(parseSkills(b.skills)),
    Number(b.years_required) || 0, b.min_salary || null, b.max_salary || null, b.status, req.params.id
  );
  res.json(jobRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id)));
  logAudit({ user: req.user, db, action: 'job.update', detail: `${existing.title} (#${existing.id})` });
});

app.delete('/api/jobs/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT title FROM jobs WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  const info = db.prepare('DELETE FROM jobs WHERE id = ? AND company_id = ?').run(req.params.id, req.user.company_id);
  if (!info.changes) return res.status(404).json({ error: 'Job not found' });
  logAudit({ user: req.user, db, action: 'job.delete', detail: `${existing?.title || req.params.id} (#${req.params.id})` });
  res.json({ ok: true });
});

// ---------- Global search ----------

app.get('/api/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ candidates: [], jobs: [], applications: [] });
  const db = getDb();
  const like = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`;
  const candidates = db
    .prepare(
      `SELECT * FROM candidates WHERE company_id = ?
         AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR skills LIKE ? ESCAPE '\\')
         ORDER BY created_at DESC LIMIT 8`
    )
    .all(req.user.company_id, like, like, like, like, like)
    .map(candidateRow);
  const jobs = db
    .prepare(
      `SELECT * FROM jobs WHERE company_id = ?
         AND (title LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
         ORDER BY created_at DESC LIMIT 8`
    )
    .all(req.user.company_id, like, like, like)
    .map(jobRow);
  const applications = db
    .prepare(
      `SELECT a.*, c.name AS candidate_name, c.title AS candidate_title, j.title AS job_title
         FROM applications a
         LEFT JOIN candidates c ON c.id = a.candidate_id
         LEFT JOIN jobs j ON j.id = a.job_id
         WHERE (j.company_id = ? OR c.company_id = ?)
           AND (c.name LIKE ? ESCAPE '\\' OR j.title LIKE ? ESCAPE '\\')
         ORDER BY a.created_at DESC LIMIT 8`
    )
    .all(req.user.company_id, req.user.company_id, like, like);
  res.json({
    candidates: candidates.map(({ name, email, title, location, ...rest }) => ({ type: 'candidate', id: rest.id, name, email, title, location })),
    jobs: jobs.map(({ title, location, type, status, ...rest }) => ({ type: 'job', id: rest.id, title, location, type, status })),
    applications,
  });
});

// ---------- Screening questions ----------

function libraryItem(db, q, jobCount) {
  return {
    id: q.id,
    label: q.label,
    description: q.description,
    type: q.type,
    options: q.options,
    default_enabled: !!q.default_enabled,
    default_required: !!q.default_required,
    jobs_using: jobCount ? jobCount.get(q.id) || 0 : undefined,
  };
}

app.get('/api/screening/questions', requireAuth, (req, res) => {
  const db = getDb();
  const library = getLibrary(db, req.user.company_id);
  const jobs = db
    .prepare('SELECT question_id, COUNT(*) AS n FROM job_screening_questions GROUP BY question_id')
    .all();
  const jobCount = new Map(jobs.map((j) => [j.question_id, j.n]));
  res.json(library.map((q) => libraryItem(db, q, jobCount)));
});

app.post('/api/screening/questions', requireAuth, (req, res) => {
  const db = getDb();
  let input;
  try {
    input = validateQuestionInput(req.body || {});
  } catch (e) {
    if (e instanceof ScreenQuestionValidation) return res.status(400).json({ error: e.message });
    throw e;
  }
  const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM screening_questions WHERE company_id = ?').get(req.user.company_id).m;
  const info = db
    .prepare(
      `INSERT INTO screening_questions (company_id, label, description, type, options, default_enabled, default_required, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.company_id, input.label, input.description, input.type, JSON.stringify(input.options), input.default_enabled, input.default_required, max + 1);
  res.status(201).json(libraryItem(db, getLibrary(db, req.user.company_id).find((q) => q.id === info.lastInsertRowid)));
});

app.put('/api/screening/questions/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM screening_questions WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!existing) return res.status(404).json({ error: 'Question not found' });
  let input;
  try {
    input = validateQuestionInput(req.body || {});
  } catch (e) {
    if (e instanceof ScreenQuestionValidation) return res.status(400).json({ error: e.message });
    throw e;
  }
  db.prepare(
    `UPDATE screening_questions SET label = ?, description = ?, type = ?, options = ?, default_enabled = ?, default_required = ? WHERE id = ?`
  ).run(input.label, input.description, input.type, JSON.stringify(input.options), input.default_enabled, input.default_required, existing.id);
  res.json(libraryItem(db, getLibrary(db, req.user.company_id).find((q) => q.id === existing.id)));
});

app.delete('/api/screening/questions/:id', requireAuth, (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM screening_questions WHERE id = ? AND company_id = ?').run(req.params.id, req.user.company_id);
  if (!info.changes) return res.status(404).json({ error: 'Question not found' });
  res.json({ ok: true });
});

app.get('/api/jobs/:id/screening', requireAuth, (req, res) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(jobConfig(db, req.user.company_id, job.id));
});

app.put('/api/jobs/:id/screening', requireAuth, (req, res) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  try {
    const questions = saveJobQuestionConfig(db, req.user.company_id, job.id, (req.body || {}).questions);
    res.json({ inherited: false, questions });
  } catch (e) {
    if (e instanceof ScreenQuestionValidation) return res.status(400).json({ error: e.message });
    throw e;
  }
});

// ---------- Matching ----------

app.get('/api/jobs/:id/matches', requireAuth, (req, res) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const candidates = db.prepare('SELECT * FROM candidates WHERE company_id = ? AND status != ?').all(req.user.company_id, 'archived');
  const withScore = candidates
    .map((c) => {
      const { score, breakdown } = scoreCandidate(jobRow(job), candidateRow(c), { verbose: true });
      return { ...candidateRow(c), score, breakdown };
    })
    .sort((a, b) => b.score - a.score);
  res.json({ job: jobRow(job), candidates: withScore });
});

app.get('/api/matches/all', requireAuth, (req, res) => {
  const db = getDb();
  const jobs = db.prepare('SELECT * FROM jobs WHERE company_id = ?').all(req.user.company_id);
  const candidates = db.prepare('SELECT * FROM candidates WHERE company_id = ? AND status != ?').all(req.user.company_id, 'archived');
  const ranked = rankCandidates(jobs.map(jobRow), candidates.map(candidateRow));
  res.json(
    ranked.map(({ job, matches }) => ({
      job,
      top_candidates: matches.slice(0, 5).map((m) => ({
        ...m.candidate,
        score: m.score,
        breakdown: m.breakdown,
      })),
    }))
  );
});

// ---------- Applications ----------

app.get('/api/applications', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, j.company_id AS company_id, j.title AS job_title, c.name AS candidate_name, c.title AS candidate_title, c.location AS candidate_location, c.skills AS candidate_skills, c.years_experience AS candidate_years
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN candidates c ON c.id = a.candidate_id
       WHERE j.company_id = ? AND c.company_id = ?
       ORDER BY a.created_at DESC`
    )
    .all(req.user.company_id, req.user.company_id);
  res.json(
    rows.map((r) => ({
      ...r,
      candidate_skills: parseSkills(r.candidate_skills),
      screening_answers: screeningAnswersForApplication(db, r),
    }))
  );
});

app.post('/api/applications', requireAuth, (req, res) => {
  const db = getDb();
  const { job_id, candidate_id, score, notes } = req.body || {};
  if (!job_id || !candidate_id) return res.status(400).json({ error: 'job_id and candidate_id are required' });
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ?').get(job_id, req.user.company_id);
  const cand = db.prepare('SELECT * FROM candidates WHERE id = ? AND company_id = ?').get(candidate_id, req.user.company_id);
  if (!job || !cand) return res.status(404).json({ error: 'Job or candidate not found' });
  try {
    const info = db
      .prepare('INSERT INTO applications (job_id, candidate_id, score, notes, tracking_token, status_updated_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(job_id, candidate_id, score ?? null, notes || null, crypto.randomUUID());
    res.status(201).json({ id: info.lastInsertRowid, job_id, candidate_id, score, notes });
    logAudit({ user: req.user, db, action: 'application.create', detail: `${cand.name} → ${job.title} (#${info.lastInsertRowid})` });
  } catch {
    return res.status(400).json({ error: 'Candidate already applied to this job' });
  }
});

app.patch('/api/applications/:id/status', requireAuth, (req, res) => {
  const db = getDb();
  const { status, notes } = req.body || {};
  const row = db
    .prepare(
      `SELECT a.* FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = ? AND j.company_id = ?`
    )
    .get(req.params.id, req.user.company_id);
  if (!row) return res.status(404).json({ error: 'Application not found' });
  db.prepare("UPDATE applications SET status = ?, notes = ?, status_updated_at = datetime('now') WHERE id = ?")
    .run(status || row.status, notes ?? row.notes, req.params.id);
  logAudit({
    user: req.user,
    db,
    action: 'application.status',
    detail: `#${row.id} (${row.candidate_name || 'candidate'} → ${status || row.status})`,
  });
  res.json(db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id));
});

// ---------- Audit log ----------

app.get('/api/audit', requireAuth, (req, res) => {
  const db = getDb();
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const rows = db
    .prepare(
      `SELECT id, user_email, action, detail, created_at
       FROM audit_log
       WHERE company_id = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(req.user.company_id, limit);
  res.json(rows);
});

// ---------- Public candidate portal ----------

app.get('/api/public/jobs', (req, res) => {
  const db = getDb();
  const company = getDefaultCompany(db);
  if (!company) return res.status(404).json({ error: 'No company configured' });
  const rows = db
    .prepare('SELECT * FROM jobs WHERE company_id = ? AND status = ? ORDER BY created_at DESC')
    .all(company.id, 'open');
  res.json(
    rows.map((j) => ({ ...scrubJob(jobRow(j)), screening_questions: effectiveQuestions(db, company.id, j.id) }))
  );
});

app.get('/api/public/jobs/:id', (req, res) => {
  const db = getDb();
  const company = getDefaultCompany(db);
  if (!company) return res.status(404).json({ error: 'No company configured' });
  const job = db
    .prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ? AND status = ?')
    .get(req.params.id, company.id, 'open');
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ ...scrubJob(jobRow(job)), screening_questions: effectiveQuestions(db, company.id, job.id) });
});

app.get('/api/public/questionnaire', (req, res) => {
  res.json(questionnairePublic());
});

app.get('/api/public/privacy', (req, res) => {
  res.json({ notice: PRIVACY_NOTICE, policy_version: POLICY_VERSION });
});

app.get('/api/public/company', (req, res) => {
  const company = getDefaultCompany(getDb());
  if (!company) return res.status(404).json({ error: 'No company configured' });
  res.json({
    id: company.id,
    name: company.name,
    brand_color: company.brand_color || null,
    logo_path: company.logo_path || null,
    nav_color: company.nav_color || null,
    accent_color: company.accent_color || null,
  });
});

app.put('/api/company/brand', requireAuth, requireAdmin, (req, res) => {
  const { brand_color } = req.body || {};
  if (typeof brand_color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(brand_color)) {
    return res.status(400).json({ error: 'brand_color must be a #RRGGBB hex value.' });
  }
  const db = getDb();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  db.prepare('UPDATE companies SET brand_color = ? WHERE id = ?').run(brand_color, company.id);
  logAudit({ user: req.user, db, action: 'company.brand', detail: `Brand color set to ${brand_color}` });
  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id);
  res.json({ company: updated });
});

app.put('/api/company/settings', requireAuth, requireAdmin, (req, res) => {
  const { name, brand_color, nav_color, accent_color } = req.body || {};
  const db = getDb();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const sets = [];
  const vals = [];
  const detail = [];
  if (name !== undefined) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed || trimmed.length > 120) {
      return res.status(400).json({ error: 'Company name must be 1–120 characters.' });
    }
    sets.push('name = ?');
    vals.push(trimmed);
    detail.push('name');
  }
  const pushColor = (field, value, label) => {
    if (value === undefined) return;
    if (value === null) {
      sets.push(`${field} = NULL`);
      detail.push(label);
      return;
    }
    if (typeof value !== 'string' || !HEX.test(value)) {
      throw new Error(`${label} must be a #RRGGBB hex value.`);
    }
    sets.push(`${field} = ?`);
    vals.push(value);
    detail.push(label);
  };
  try {
    pushColor('brand_color', brand_color, 'brand_color');
    pushColor('nav_color', nav_color, 'nav_color');
    pushColor('accent_color', accent_color, 'accent_color');
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: 'Nothing to update — provide at least one setting.' });
  }
  vals.push(company.id);
  db.prepare(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  logAudit({ user: req.user, db, action: 'company.update', detail: `Settings updated: ${detail.join(', ')}` });
  res.json({ company: db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id) });
});

app.post('/api/public/resume/parse', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Send the resume as a "resume" file field.' });
  try {
    const parsed = await readResume({ buffer: req.file.buffer, filename: req.file.originalname });
    if (!parsed.text || !parsed.text.trim()) {
      return res.status(422).json({ error: 'No text could be read from this file. Scanned/image-only PDFs aren\u2019t supported yet.' });
    }
    res.json({ ok: true, filename: req.file.originalname, ext: parsed.ext, text: parsed.text, fields: parsed.fields });
  } catch (e) {
    if (e instanceof UnsupportedResumeError) return res.status(415).json({ error: e.message });
    res.status(422).json({ error: 'Could not read this file. Please try a different resume.' });
  }
});

function safeJson(value) {
  if (value == null || value === '') return null;
  try { return JSON.parse(value); } catch { return null; }
}

function sanitizedAnswers(answers) {
  const out = {};
  if (!answers || typeof answers !== 'object') return out;
  for (const q of QUESTIONNAIRE) {
    const v = answers[q.key];
    if (typeof v !== 'string') continue;
    if (q.options.some((o) => o.value === v)) out[q.key] = v;
    if (q.detailField && typeof answers[q.detailField] === 'string' && answers[q.detailField].trim()) {
      out[q.detailField] = answers[q.detailField].trim().slice(0, 200);
    }
  }
  return out;
}

function storeResumeFile(file) {
  const ext = String((file.originalname || '').split('.').pop() || '').toLowerCase();
  const stored = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(resolveUploadsDir(), stored), file.buffer);
  return {
    resume_filename: path.basename(file.originalname || stored),
    resume_path: stored,
  };
}

function storeLogoFile(file) {
  const ext = String((file.originalname || '').split('.').pop() || '').toLowerCase();
  const stored = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(resolveUploadsDir(), stored), file.buffer);
  return stored;
}

function deleteStoredFile(stored) {
  if (!stored) return;
  try {
    fs.unlinkSync(path.join(resolveUploadsDir(), path.basename(stored)));
  } catch { /* already gone */ }
}

app.get('/api/company/logo', (req, res) => {
  const db = getDb();
  const company = req.query.company
    ? db.prepare('SELECT * FROM companies WHERE id = ?').get(req.query.company)
    : getDefaultCompany(db);
  if (!company || !company.logo_path) return res.status(404).json({ error: 'No company logo' });
  const file = path.join(resolveUploadsDir(), path.basename(company.logo_path));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'No company logo' });
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.sendFile(file);
});

// Company branding lookup: let an admin find any company in the system and
// adopt its logo + colors. Returns branding-neutral fields only.
app.get('/api/companies/search', requireAuth, requireAdmin, (req, res) => {
  const q = String(req.query.q || '').trim();
  const db = getDb();
  const like = q ? `%${q.replace(/[%_]/g, (m) => '\\' + m)}%` : '%';
  const rows = q
    ? db.prepare(`SELECT id, name, brand_color, nav_color, accent_color, logo_path FROM companies
                   WHERE name LIKE ? ESCAPE '\\' AND id != ?
                   ORDER BY name COLLATE NOCASE LIMIT 10`).all(like, req.user.company_id)
    : db.prepare('SELECT id, name, brand_color, nav_color, accent_color, logo_path FROM companies WHERE id != ? ORDER BY name COLLATE NOCASE LIMIT 10').all(req.user.company_id);
  res.json(rows.map((r) => ({ ...r, brand_color: r.brand_color || null, nav_color: r.nav_color || null, accent_color: r.accent_color || null, logo_path: r.logo_path || null })));
});

// ---------- external company lookup ("find any company") ----------

async function fetchWithTimeout(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'TalentFlow/1.0 (company branding lookup)' } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}

function extractLinkedInUrl(text) {
  const m = String(text || '').match(/https?:\/\/(?:[\w-]+\.)*linkedin\.com\/company\/[A-Za-z0-9._%+-]+/);
  return m ? m[0].replace(/[?&].*$/, '').replace(/[.,;:)]+$/, '') : null;
}

function collectUrls(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((n) => collectUrls(n, out)); return out; }
  for (const key of ['Text', 'FirstURL', 'URL', 'AbstractURL']) {
    if (typeof node[key] === 'string') {
      const u = extractLinkedInUrl(node[key]);
      if (u && !out.includes(u)) out.push(u);
    }
  }
  collectUrls(node.Topics, out);
  collectUrls(node.NestedResult, out);
  collectUrls(node.Results, out);
  return out;
}

// Resolve the official logo for a company via Wikidata's "logo image" property
// (P154) — far more reliable than picking an arbitrary page image. Falls back
// to the Wikipedia page image when no Wikidata logo exists.
async function logoUrlFor(title) {
  try {
    const searchRes = await fetchWithTimeout(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(title)}&language=en&limit=1&format=json&type=item`,
      4500
    );
    const searchData = await searchRes.json();
    const item = searchData?.search?.[0];
    if (item?.id) {
      const entRes = await fetchWithTimeout(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(item.id)}&props=claims&format=json`,
        4500
      );
      const entData = await entRes.json();
      const filename = entData?.entities?.[item.id]?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
      if (typeof filename === 'string' && filename.trim()) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename.trim())}?width=512`;
      }
    }
  } catch { /* fall through to page image */ }
  try {
    const res = await fetchWithTimeout(
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&redirects=1&titles=${encodeURIComponent(title)}`,
      4500
    );
    const data = await res.json();
    const page = Object.values(data?.query?.pages || {})[0];
    return page?.original?.source || page?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

async function linkedInUrlFor(name) {
  try {
    const res = await fetchWithTimeout(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(`"${name}" linkedin company`)}&format=json&no_html=1&skip_disambig=1&t=talentflow`,
      4500
    );
    const data = await res.json();
    const urls = collectUrls(data);
    return urls[0] || null;
  } catch {
    return null;
  }
}

// Search public companies by name and return candidates with their real logo,
// plus a matching LinkedIn company page. Keyless, bot-friendly lookups only.
app.get('/api/company/lookup', requireAuth, requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Provide a company name to search.' });
  if (q.length > 120) return res.status(400).json({ error: 'Search query too long.' });
  try {
    const resOp = await fetchWithTimeout(
      `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&namespace=0&limit=5&search=${encodeURIComponent(q)}`,
      5000
    );
    let titles = [];
    try {
      const opened = await resOp.json();
      titles = Array.isArray(opened[1]) ? opened[1].slice(0, 5) : [];
    } catch { /* non-JSON / rate-limited reply — treat as no candidates */ }
    const candidates = [];
    for (const title of titles) {
      const entry = { name: title, logoUrl: null, linkedinUrl: null };
      try { entry.logoUrl = await logoUrlFor(title); } catch { /* no logo */ }
      if (candidates.length === 0) try { entry.linkedinUrl = await linkedInUrlFor(title); } catch { /* no linkedin */ }
      candidates.push(entry);
    }
    res.json({ query: q, candidates });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the company directory. Try again in a moment.' });
  }
});

// Adopt a looked-up company: copies the remote logo locally, derives a brand
// color from it, and sets the org title + LinkedIn profile for a custom
// light/dark theme that matches the adopted company.
app.post('/api/company/adopt', requireAuth, requireAdmin, async (req, res) => {
  const { name, logoUrl, linkedinUrl } = req.body || {};
  const db = getDb();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed.length > 120) {
    return res.status(400).json({ error: 'Please provide the company name (1–120 characters).' });
  }
  if (!logoUrl || typeof logoUrl !== 'string') {
    return res.status(422).json({ error: 'No logo found for this company, so branding cannot be adopted.' });
  }

  // All-or-nothing: fetch the logo, validate it, and derive the brand color
  // BEFORE touching the database. If any step fails, nothing changes.
  let stored = null;
  let buf = null;
  let derived = null;
  try {
    const ictrl = new AbortController();
    const timer = setTimeout(() => ictrl.abort(), 9000);
    let img;
    let ct = '';
    try {
      img = await fetch(logoUrl, { signal: ictrl.signal, headers: { 'User-Agent': 'TalentFlow/1.0 (logo adopt)' } });
      ct = String(img.headers.get('content-type') || '').toLowerCase();
      buf = Buffer.from(await img.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
    const looksImage = ct.includes('image/') || buf[0] === 0x89 || buf.slice(0, 512).toString('latin1').includes('<svg');
    if (!img.ok || buf.length === 0 || buf.length > 8 * 1024 * 1024 || !looksImage) {
      return res.status(502).json({ error: "Could not download this company's logo. No changes were made." });
    }
    derived = sampleBrandColor(buf, ct);
    if (!derived) {
      return res.status(422).json({ error: "Could not determine a brand color from the logo. No changes were made." });
    }
    let ext = '.png';
    if (ct.includes('svg') || buf.slice(0, 512).toString('latin1').includes('<svg')) ext = '.svg';
    else if (ct.includes('jpeg') || ct.includes('jpg')) ext = '.jpg';
    else if (ct.includes('webp')) ext = '.webp';
    else if (ct.includes('gif')) ext = '.gif';
    stored = `${crypto.randomUUID()}${ext}`;
  } catch {
    return res.status(502).json({ error: "Could not download this company's logo. No changes were made." });
  }

  // Every step succeeded — commit the full branding change atomically.
  try {
    fs.writeFileSync(path.join(getUploadsDir(), stored), buf);
    const sets = ['name = ?', 'brand_color = ?'];
    const vals = [trimmed, derived];
    sets.push('logo_path = ?');
    vals.push(stored);
    deleteStoredFile(company.logo_path);
    if (linkedinUrl !== undefined) {
      sets.push('linkedin_url = ?');
      vals.push(linkedinUrl ? String(linkedinUrl).trim().slice(0, 300) : null);
    }
    vals.push(company.id);
    db.prepare(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  } catch {
    deleteStoredFile(stored);
    return res.status(502).json({ error: 'Something went wrong while applying the branding. No changes were made.' });
  }
  logAudit({ user: req.user, db, action: 'company.adopt', detail: `Branding adopted from "${trimmed}" (logo + color)` });
  res.json({ company: db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id) });
});

app.put('/api/company/logo', requireAuth, requireAdmin, uploadLogo.single('logo'), (req, res) => {
  const db = getDb();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({ error: 'No image uploaded. Send the logo as a "logo" file field.' });
  }
  const stored = storeLogoFile(req.file);
  deleteStoredFile(company.logo_path);
  db.prepare('UPDATE companies SET logo_path = ? WHERE id = ?').run(stored, company.id);
  logAudit({ user: req.user, db, action: 'company.logo', detail: 'Company logo updated' });
  res.json({ company: db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id) });
});

app.delete('/api/company/logo', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  deleteStoredFile(company.logo_path);
  db.prepare('UPDATE companies SET logo_path = NULL WHERE id = ?').run(company.id);
  logAudit({ user: req.user, db, action: 'company.logo', detail: 'Company logo removed' });
  res.json({ company: db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id) });
});

// Adopt another company's logo (branding copy). Copies the source's stored
// file under a fresh name so the current org owns its logo going forward.
app.post('/api/company/logo/import', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const { company_id } = req.body || {};
  const source = company_id ? db.prepare('SELECT * FROM companies WHERE id = ?').get(company_id) : null;
  if (!source) return res.status(404).json({ error: 'Source company not found' });
  if (!source.logo_path) return res.status(400).json({ error: 'That company has no logo to import.' });
  const srcFile = path.join(resolveUploadsDir(), path.basename(source.logo_path));
  if (!fs.existsSync(srcFile)) return res.status(400).json({ error: 'That company has no logo to import.' });
  const ext = path.extname(srcFile).toLowerCase();
  const stored = `${crypto.randomUUID()}${ext}`;
  fs.copyFileSync(srcFile, path.join(resolveUploadsDir(), stored));
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  deleteStoredFile(company.logo_path);
  db.prepare('UPDATE companies SET logo_path = ? WHERE id = ?').run(stored, company.id);
  logAudit({ user: req.user, db, action: 'company.logo', detail: `Branding logo imported from company #${source.id}` });
  res.json({ company: db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id) });
});

app.post('/api/public/applications', upload.single('resume'), async (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const { job_id, name, email, phone, location, summary, years_experience } = body;
  const skills = Array.isArray(body.skills) ? body.skills : (safeJson(body.skills) || []);
  const education = Array.isArray(body.education) ? body.education : (safeJson(body.education) || []);
  const experience = Array.isArray(body.experience) ? body.experience : (safeJson(body.experience) || []);
  const questionnaire = sanitizedAnswers(safeJson(body.questionnaire) || body.questionnaire);
  if (!job_id || !name || !email) return res.status(400).json({ error: 'name, email and job_id are required' });
  if (body.consent !== 'true' && body.consent !== true) {
    return res.status(422).json({ error: 'You must agree to the privacy notice before your application can be submitted.' });
  }
  const company = getDefaultCompany(db);
  if (!company) return res.status(404).json({ error: 'No company configured' });
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ? AND status = ?').get(job_id, company.id, 'open');
  if (!job) return res.status(404).json({ error: 'Job not found or no longer open' });

  const screeningInput = safeJson(body.screening) || body.screening;
  const screening = sanitizeScreeningAnswers(effectiveQuestions(db, company.id, job.id), screeningInput);
  if (Object.keys(screening.errors).length > 0) {
    return res.status(422).json({
      error: 'Please answer all required questions',
      missing: Object.values(screening.errors),
    });
  }

  let resume = { resume_text: null, resume_filename: null, resume_path: null, attached: false };
  if (req.file) {
    try {
      const parsed = await readResume({ buffer: req.file.buffer, filename: req.file.originalname });
      resume = { resume_text: parsed.text || null, ...storeResumeFile(req.file), attached: true };
    } catch (e) {
      if (e instanceof UnsupportedResumeError) return res.status(415).json({ error: e.message });
      return res.status(422).json({ error: 'Could not read this file. Please try a different resume.' });
    }
  } else if (typeof body.resume_text === 'string' && body.resume_text.trim()) {
    resume.resume_text = body.resume_text.trim();
  }

  const existing = db.prepare('SELECT * FROM candidates WHERE company_id = ? AND email = ?').get(company.id, email);
  let candidateId;
  if (existing) {
    candidateId = existing.id;
    const sameJobApp = db
      .prepare('SELECT * FROM applications WHERE job_id = ? AND candidate_id = ?')
      .get(job_id, candidateId);
    if (sameJobApp) {
      return res.status(409).json({
        error: 'You have already applied to this job',
        tracking_token: sameJobApp.tracking_token,
        existing_application: true,
      });
    }
  } else {
    const info = db
      .prepare(
        `INSERT INTO candidates (company_id, name, email, phone, location, title, summary, years_experience, skills, education, experience, resume_text, resume_filename, resume_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        company.id, name, email, phone || null, location || null, job.title || null,
        summary || null, Number(years_experience) || 0, JSON.stringify(skills || []),
        JSON.stringify(education || []), JSON.stringify(experience || []),
        resume.resume_text, resume.resume_filename, resume.resume_path
      );
    candidateId = info.lastInsertRowid;
  }

  if (resume.attached && existing) {
    db.prepare('UPDATE candidates SET resume_text = ?, resume_filename = ?, resume_path = ? WHERE id = ?')
      .run(resume.resume_text || existing.resume_text, resume.resume_filename, resume.resume_path, candidateId);
  } else if (resume.resume_text && existing && !existing.resume_text) {
    db.prepare('UPDATE candidates SET resume_text = ? WHERE id = ?').run(resume.resume_text, candidateId);
  }

  const token = crypto.randomUUID();
  const info = db
    .prepare(
      "INSERT INTO applications (job_id, candidate_id, tracking_token, consented_at, policy_version, status_updated_at) VALUES (?, ?, ?, datetime('now'), ?, datetime('now'))"
    )
    .run(job_id, candidateId, token, POLICY_VERSION);

  const eeoKeys = Object.keys(questionnaire);
  const screeningKeys = Object.keys(screening.answers);
  if (eeoKeys.length > 0 || screeningKeys.length > 0) {
    db.prepare('INSERT INTO application_answers (application_id, data) VALUES (?, ?)')
      .run(info.lastInsertRowid, JSON.stringify({ eeo: questionnaire, screening: screening.answers }));
  }

  res.status(201).json({
    id: info.lastInsertRowid,
    tracking_token: token,
    status: 'matched',
    job: { id: job.id, title: job.title, department: job.department, location: job.location },
    applied_at: new Date().toISOString(),
    resume_attached: resume.attached,
    consent: { required: true, policy_version: POLICY_VERSION, consented_at: new Date().toISOString() },
  });

  logAudit({
    user: req.user || { company_id: company.id, id: null, email },
    db,
    action: 'application.create',
    detail: `${existing ? existing.name : name} <${email}> → ${job.title}`,
  });
});

function publicApplicationRow(db, app) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(app.job_id);
  const cand = db.prepare('SELECT * FROM candidates WHERE id = ?').get(app.candidate_id);
  const stageIndex = PUBLIC_STAGES.includes(app.status) ? PUBLIC_STAGES.indexOf(app.status) : -1;
  return {
    tracking_token: app.tracking_token,
    status: app.status,
    stage_index: stageIndex,
    applied_at: app.created_at,
    last_updated: app.status_updated_at || app.created_at,
    job: job ? scrubJob(jobRow(job)) : null,
    candidate: cand ? { name: cand.name, email: cand.email } : null,
    consent: cand ? {
      policy_version: app.policy_version || null,
      consented_at: app.consented_at || null,
    } : null,
  };
}

app.get('/api/public/applications/:token', (req, res) => {
  const db = getDb();
  const app = db.prepare('SELECT * FROM applications WHERE tracking_token = ?').get(req.params.token);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  res.json(publicApplicationRow(db, app));
});

app.post('/api/public/applications/lookup', (req, res) => {
  const db = getDb();
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });
  const company = getDefaultCompany(db);
  if (!company) return res.json([]);
  const cand = db.prepare('SELECT id FROM candidates WHERE company_id = ? AND email = ?').get(company.id, email);
  if (!cand) return res.json([]);
  const apps = db
    .prepare('SELECT * FROM applications WHERE candidate_id = ? ORDER BY created_at DESC')
    .all(cand.id);
  res.json(apps.map((a) => publicApplicationRow(db, a)));
});

// ---------- Manage my data (portal privacy flow) ----------

app.post('/api/public/export', (req, res) => {
  const db = getDb();
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });
  const company = getDefaultCompany(db);
  const cand = company
    ? db.prepare('SELECT * FROM candidates WHERE company_id = ? AND email = ?').get(company.id, email)
    : undefined;
  if (!cand) return res.status(404).json({ error: 'No candidate data found for that email' });

  const apps = db.prepare('SELECT * FROM applications WHERE candidate_id = ? ORDER BY created_at DESC').all(cand.id);
  const appsOut = apps.map((a) => {
    const answers = db.prepare('SELECT data FROM application_answers WHERE application_id = ?').get(a.id);
    const job = db.prepare('SELECT title, department, location FROM jobs WHERE id = ?').get(a.job_id);
    return {
      job_id: a.job_id,
      job: job ? `${job.title}${job.department ? ` (${job.department})` : ''}` : null,
      status: a.status,
      applied_at: a.created_at,
      last_updated: a.status_updated_at || a.created_at,
      notes: a.notes || null,
      answers: answers ? safeJson(answers.data) : null,
      consent: { policy_version: a.policy_version, consented_at: a.consented_at },
      resume_attached: !!cand.resume_path,
    };
  });

  const erasure_token = apps[0]?.tracking_token || null;
  const data = {
    exported_at: new Date().toISOString(),
    policy_version: POLICY_VERSION,
    candidate: {
      name: cand.name,
      email: cand.email,
      phone: cand.phone || null,
      location: cand.location || null,
      title: cand.title || null,
      summary: cand.summary || null,
      years_experience: cand.years_experience,
      skills: cand.skills ? parseSkills(cand.skills) : [],
      resume_filename: cand.resume_filename || null,
    },
    applications: appsOut,
    erasure_token,
    erasure_note: 'To delete your data, call the erasure endpoint with your email plus this token (one of your application tracking links).',
  };
  res.json(data);
});

app.post('/api/public/erasure', (req, res) => {
  const db = getDb();
  const { email, erasure_token } = req.body || {};
  if (!email || !erasure_token) {
    return res.status(400).json({ error: 'email and erasure_token are required' });
  }
  const company = getDefaultCompany(db);
  if (!company) return res.status(404).json({ error: 'No company configured' });
  const cand = db.prepare('SELECT * FROM candidates WHERE company_id = ? AND email = ?').get(company.id, email);
  if (!cand) return res.status(404).json({ error: 'No candidate data found for that email' });

  const tokenRow = db
    .prepare('SELECT * FROM applications WHERE candidate_id = ? AND tracking_token = ?')
    .get(cand.id, erasure_token);
  if (!tokenRow) {
    return res.status(403).json({ error: 'Invalid erasure token. Export your data first to receive one.' });
  }

  if (cand.resume_path) {
    const file = path.join(resolveUploadsDir(), path.basename(cand.resume_path));
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch { /* best-effort file cleanup */ }
    }
  }
  const affected = db.prepare('SELECT COUNT(*) AS n FROM applications WHERE candidate_id = ?').get(cand.id).n;
  db.prepare('DELETE FROM applications WHERE candidate_id = ?').run(cand.id);
  db.prepare('DELETE FROM candidates WHERE id = ?').run(cand.id);
  logAudit({ user: { company_id: cand.company_id }, db, action: 'candidate.erasure', detail: `${email} (${cand.name})` });
  res.json({
    ok: true,
    message: 'Your data and applications have been deleted, along with any uploaded resume.',
    affected_applications: affected,
  });
});

export { app };

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const error = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
    return res.status(400).json({ error });
  }
  if (err && err.message === 'Unsupported file type. Use .pdf, .docx, or .txt') {
    return res.status(415).json({ error: err.message });
  }
  if (err && err.message.startsWith('Unsupported logo type.')) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

if (process.env.NODE_ENV !== 'test') {
  if (process.env.SEED_ON_BOOT === '1' || process.env.SEED_ON_BOOT === 'true') {
    seed();
    console.log('[TalentFlow] Demo seed applied.');
  }

  if (process.env.SERVE_CLIENT !== 'off') {
    const indexFile = path.join(CLIENT_DIST, 'index.html');
    if (fs.existsSync(indexFile)) {
      app.use(express.static(CLIENT_DIST));
      app.get(/^(?!\/api(\/|$)).*/, (req, res) => res.sendFile(indexFile));
      console.log(`[TalentFlow] Serving client from ${CLIENT_DIST}`);
    } else {
      console.warn(`[TalentFlow] client/dist not found at ${CLIENT_DIST} — API only. Run "cd client && npm run build".`);
    }
  }

  app.listen(PORT, () => console.log(`TalentFlow API listening on http://localhost:${PORT}`));
}