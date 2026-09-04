import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

function multipart(fields, file) {
  const boundary = `----tf${Date.now()}`;
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  }
  if (file) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.type}\r\n\r\n`
    );
    const buf = Buffer.concat([Buffer.from(parts.join('')), file.buffer, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    return { body: buf, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
  }
  const body = Buffer.from(`${parts.join('')}--${boundary}--\r\n`);
  return { body, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

test('portal: questionnaire, resume auto-fill, apply with EEO answers + uploaded file (no leaks)', async () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-portal2-'));
  process.env.DB_PATH = path.join(dbDir, 'p.db');
  process.env.UPLOADS_DIR = path.join(dbDir, 'uploads');
  process.env.NODE_ENV = 'test';

  const { createDb } = await import('../src/db.js');
  const db = createDb();
  const co = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Portal Co').lastInsertRowid;
  const jobId = db.prepare(
    `INSERT INTO jobs (company_id, title, department, location, description, requirements, skills, years_required)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(co, 'Backend Engineer', 'Engineering', 'Remote', 'Build APIs', JSON.stringify(['APIs']), JSON.stringify(['Python', 'SQL']), 3).lastInsertRowid;

  const { app } = await import('../src/index.js');
  const server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // questionnaire is served publicly with the standard questions
    const q = await (await fetch(`${base}/api/public/questionnaire`)).json();
    assert.equal(q.version, 1);
    const keys = q.questions.map((x) => x.key);
    assert.deepEqual(keys, ['current_employee', 'gender', 'race_ethnicity', 'veteran_status', 'disability']);
    assert.ok(q.questions.find((x) => x.key === 'disability').disclosure);
    assert.ok(q.privacy.includes('voluntary'));

    // parsing a .txt resume returns prefilled fields
    const resumeText = 'Jane Q. Engineering\nSan Francisco, CA | jane.eng@example.dev | (415) 555-0192\n\n' +
      'Professional Summary\nBackend engineer with 6+ years of experience in Python, PostgreSQL and Docker.\n\n' +
      'Technical Skills\nPython, PostgreSQL, Docker, Kubernetes, Git';
    const parsed = await (await fetch(`${base}/api/public/resume/parse`, {
      method: 'POST',
      ...multipart({}, { name: 'resume', filename: 'jane.txt', type: 'text/plain', buffer: Buffer.from(resumeText) }),
    })).json();
    assert.equal(parsed.ok, true);
    assert.equal(parsed.fields.email, 'jane.eng@example.dev');
    assert.equal(parsed.fields.years_experience, 6);
    assert.ok(parsed.fields.skills.includes('python'));

    // unsupported file type -> 415
    const bad = await fetch(`${base}/api/public/resume/parse`, {
      method: 'POST',
      ...multipart({}, { name: 'resume', filename: 'a.exe', type: 'application/octet-stream', buffer: Buffer.from('MZ') }),
    });
    assert.equal(bad.status, 415);

    // apply with answers + uploaded resume
    const questionnaire = JSON.stringify({
      current_employee: 'no',
      gender: 'self_identify',
      gender_detail: 'Agender',
      race_ethnicity: 'asian',
      veteran_status: 'decline',
      disability: 'yes',
      evil_key: 'injected',
    });
    const apply = await (await fetch(`${base}/api/public/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        name: 'Jane Q. Engineering',
        email: 'jane.eng@example.dev',
        skills: ['Python', 'PostgreSQL', 'Docker'],
        years_experience: 6,
        questionnaire,
        resume_text: resumeText,
      }),
    })).json();
    assert.ok(apply.tracking_token);
    assert.equal(apply.status, 'matched');

    const cand = db.prepare('SELECT * FROM candidates WHERE email = ?').get('jane.eng@example.dev');
    assert.ok(cand, 'candidate auto-created');
    assert.equal(cand.resume_text, resumeText);

    const appRow = db.prepare('SELECT * FROM applications WHERE tracking_token = ?').get(apply.tracking_token);
    const answers = db.prepare('SELECT * FROM application_answers WHERE application_id = ?').get(appRow.id);
    assert.ok(answers, 'EEO answers stored');
    const data = JSON.parse(answers.data);
    assert.equal(data.eeo.current_employee, 'no');
    assert.equal(data.eeo.gender, 'self_identify');
    assert.equal(data.eeo.gender_detail, 'Agender');
    assert.equal(data.eeo.race_ethnicity, 'asian');
    assert.equal(data.eeo.disability, 'yes');
    assert.deepEqual(data.screening, {});
    assert.ok(!('evil_key' in data.eeo), 'unknown answer keys are dropped');

    // recruiter applications listing (a.*) cannot contain answer data by construction
    assert.ok(!Object.keys(appRow).includes('answers'), 'applications table is answer-free');
    assert.ok(!('questionnaire' in appRow));

    // portal status does not leak answers
    const status = await (await fetch(`${base}/api/public/applications/${apply.tracking_token}`)).json();
    assert.ok(!('questionnaire_answers' in status));
    assert.ok(!('answers' in status));
    assert.ok(!('race_ethnicity' in status));
    assert.equal(status.job.title, 'Backend Engineer');

    // multipart apply with an actual file stored to disk
    const txtBody = Buffer.from('Priya Patel\nChicago, IL | priya.file@example.dev | (312) 555-0101\n\nProfessional Summary\nPython developer with 4 years of experience.');
    const apply2 = await (await fetch(`${base}/api/public/applications`, {
      method: 'POST',
      ...multipart(
        {
          job_id: String(jobId),
          name: 'Priya Patel',
          email: 'priya.file@example.dev',
          skills: JSON.stringify(['Python']),
          years_experience: '4',
          questionnaire: JSON.stringify({ current_employee: 'decline', gender: 'female' }),
        },
        { name: 'resume', filename: 'priya.txt', type: 'text/plain', buffer: txtBody }
      ),
    })).json();
    assert.ok(apply2.tracking_token);
    const priya = db.prepare('SELECT * FROM candidates WHERE email = ?').get('priya.file@example.dev');
    assert.equal(priya.resume_filename, 'priya.txt');
    assert.ok(priya.resume_path, 'file stored to disk');
    assert.ok(priya.resume_text.includes('Priya Patel'));
    assert.ok(fs.existsSync(path.join(process.env.UPLOADS_DIR, priya.resume_path)), 'stored resume exists on disk');
  } finally {
    server.close();
    db.close();
  }
});