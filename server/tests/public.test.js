import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createDb } from '../src/db.js';

test('public candidate portal: browse jobs, apply, track status', async () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-public-'));
  const dbFile = path.join(dbDir, 'p.db');
  process.env.DB_PATH = dbFile;
  process.env.NODE_ENV = 'test';

  const db = createDb(dbFile);
  const co = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Portal Co').lastInsertRowid;
  const jobId = db.prepare(
    `INSERT INTO jobs (company_id, title, department, location, description, requirements, skills, years_required)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(co, 'Frontend Engineer', 'Engineering', 'Remote', 'Build UI', JSON.stringify(['Ship UI']), JSON.stringify(['React', 'CSS']), 2).lastInsertRowid;

  const { app } = await import('../src/index.js');
  const server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // public job listing works without auth
    const jobs = await (await fetch(`${base}/api/public/jobs`)).json();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, 'Frontend Engineer');
    assert.ok(!('company_id' in jobs[0]), 'should not leak company_id');

    // apply (one-click)
    const apply = await (await fetch(`${base}/api/public/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, name: 'Portal Applicant', email: 'portal@x.com', skills: ['React'] }),
    })).json();
    assert.ok(apply.tracking_token);
    assert.equal(apply.status, 'matched');

    // candidate + application were created
    const cand = db.prepare('SELECT * FROM candidates WHERE email = ?').get('portal@x.com');
    assert.ok(cand, 'candidate should be auto-created from public apply');

    // duplicate apply returns existing token, no new rows
    const dup = await (await fetch(`${base}/api/public/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, name: 'Portal Applicant', email: 'portal@x.com' }),
    })).json();
    assert.equal(dup.existing_application, true);
    assert.equal(dup.tracking_token, apply.tracking_token);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM applications').get().n, 1);

    // status endpoint: no internal score leaked
    const status = await (await fetch(`${base}/api/public/applications/${apply.tracking_token}`)).json();
    assert.equal(status.status, 'matched');
    assert.equal(status.job.title, 'Frontend Engineer');
    assert.ok(!('score' in status), 'should not leak internal score');

    // email lookup
    const lookup = await (await fetch(`${base}/api/public/applications/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'portal@x.com' }),
    })).json();
    assert.equal(lookup.length, 1);
    assert.equal(lookup[0].tracking_token, apply.tracking_token);
  } finally {
    server.close();
    db.close();
  }
});