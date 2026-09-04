import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';
import { requireAuth, signToken } from './auth.js';
import { scoreCandidate, rankCandidates, parseSkills } from './matching.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

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
      `SELECT a.*, j.title AS job_title, c.name AS candidate_name, c.skills AS candidate_skills
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN candidates c ON c.id = a.candidate_id
       WHERE j.company_id = ? AND c.company_id = ?
       ORDER BY a.created_at DESC`
    )
    .all(req.user.company_id, req.user.company_id);
  res.json(rows.map((r) => ({ ...r, candidate_skills: parseSkills(r.candidate_skills) })));
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
      .prepare('INSERT INTO applications (job_id, candidate_id, score, notes) VALUES (?, ?, ?, ?)')
      .run(job_id, candidate_id, score ?? null, notes || null);
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
  db.prepare('UPDATE applications SET status = ?, notes = ? WHERE id = ?')
    .run(status || row.status, notes ?? row.notes, req.params.id);
  res.json(db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id));
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`TalentFlow API listening on http://localhost:${PORT}`));
}