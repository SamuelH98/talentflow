import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getDb, uploadsDir } from './db.js';
import { requireAuth, signToken } from './auth.js';
import { scoreCandidate, rankCandidates, parseSkills } from './matching.js';
import { readResume, UnsupportedResumeError } from './resume.js';
import { QUESTIONNAIRE, questionnairePublic } from './questionnaire.js';
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
});

app.delete('/api/candidates/:id', requireAuth, (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM candidates WHERE id = ? AND company_id = ?').run(req.params.id, req.user.company_id);
  if (!info.changes) return res.status(404).json({ error: 'Candidate not found' });
  res.json({ ok: true });
});

app.get('/api/candidates/:id/resume', requireAuth, (req, res) => {
  const db = getDb();
  const row = db
    .prepare('SELECT id, resume_path, resume_filename FROM candidates WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.company_id);
  if (!row || !row.resume_path) return res.status(404).json({ error: 'No resume on file for this candidate' });
  const file = path.join(uploadsDir, path.basename(row.resume_path));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Resume file is missing' });
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
});

app.delete('/api/jobs/:id', requireAuth, (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM jobs WHERE id = ? AND company_id = ?').run(req.params.id, req.user.company_id);
  if (!info.changes) return res.status(404).json({ error: 'Job not found' });
  res.json({ ok: true });
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
      `SELECT a.*, j.company_id AS company_id, j.title AS job_title, c.name AS candidate_name, c.skills AS candidate_skills
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
  res.json(db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id));
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
  fs.writeFileSync(path.join(uploadsDir, stored), file.buffer);
  return {
    resume_filename: path.basename(file.originalname || stored),
    resume_path: stored,
  };
}

app.post('/api/public/applications', upload.single('resume'), async (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const { job_id, name, email, phone, location, summary, years_experience } = body;
  const skills = Array.isArray(body.skills) ? body.skills : (safeJson(body.skills) || []);
  const questionnaire = sanitizedAnswers(safeJson(body.questionnaire) || body.questionnaire);
  if (!job_id || !name || !email) return res.status(400).json({ error: 'name, email and job_id are required' });
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
        `INSERT INTO candidates (company_id, name, email, phone, location, title, summary, years_experience, skills, resume_text, resume_filename, resume_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        company.id, name, email, phone || null, location || null, job.title || null,
        summary || null, Number(years_experience) || 0, JSON.stringify(skills || []) ,
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
    .prepare("INSERT INTO applications (job_id, candidate_id, tracking_token, status_updated_at) VALUES (?, ?, ?, datetime('now'))")
    .run(job_id, candidateId, token);

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

export { app };

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const error = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
    return res.status(400).json({ error });
  }
  if (err && err.message === 'Unsupported file type. Use .pdf, .docx, or .txt') {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`TalentFlow API listening on http://localhost:${PORT}`));
}