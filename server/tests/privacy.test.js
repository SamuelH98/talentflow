import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createDb } from '../src/db.js';
import { signToken } from '../src/auth.js';

function jsonReq(base, method, route, token, body) {
  return fetch(`${base}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

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
    return { method: 'POST', body: buf, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
  }
  const body = Buffer.from(`${parts.join('')}--${boundary}--\r\n`);
  return { method: 'POST', body, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

test('candidate privacy: consent, export, erasure, audit log', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-privacy-'));
  const dbDir = path.join(tmpDir, 'data');
  const upDir = path.join(tmpDir, 'uploads');
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(upDir, { recursive: true });
  const dbFile = path.join(dbDir, 'p.db');
  process.env.DB_PATH = dbFile;
  process.env.UPLOADS_DIR = upDir;
  process.env.NODE_ENV = 'test';

  const db = createDb(dbFile);
  const co = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Privacy Co').lastInsertRowid;
  const recruiterId = db
    .prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)')
    .run(co, 'Recruiter Raquel', 'raquel@privacy.co', bcrypt.hashSync('pw', 10), 'recruiter').lastInsertRowid;
  const rec = db.prepare('SELECT * FROM users WHERE id = ?').get(recruiterId);
  const token = signToken(rec);
  const jobId = db
    .prepare(`INSERT INTO jobs (company_id, title, department, location, status) VALUES (?,?,?,?,?)`)
    .run(co, 'Staff Engineer', 'Engineering', 'Remote', 'open').lastInsertRowid;
  const job2Id = db
    .prepare(`INSERT INTO jobs (company_id, title, department, location, status) VALUES (?,?,?,?,?)`)
    .run(co, 'API Engineer', 'Engineering', 'Remote', 'open').lastInsertRowid;

  const { app } = await import('../src/index.js');
  const server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // --- consent required ---
    const noConsent = await jsonReq(base, 'POST', '/api/public/applications', null, { job_id: jobId, name: 'Daisy', email: 'daisy@x.com' });
    assert.equal(noConsent.status, 422, 'apply without consent rejected');

    // --- apply with consent + resume FILE (so we can verify file cleanup) ---
    const apply = await (await fetch(
      `${base}/api/public/applications`,
      multipart(
        {
          job_id: String(jobId),
          name: 'Grace Lee',
          email: 'grace.lee@x.com',
          skills: JSON.stringify(['Node.js', 'Docker']),
          consent: 'true',
        },
        { name: 'resume', filename: 'grace.txt', type: 'text/plain', buffer: Buffer.from('Grace Lee\nNode.js engineer with 5 years of experience.') }
      )
    )).json();
    assert.ok(apply.tracking_token);
    assert.ok(apply.consent?.consented_at, 'apply returns consent confirmation');

    const appRow = db.prepare('SELECT * FROM applications WHERE tracking_token = ?').get(apply.tracking_token);
    assert.equal(appRow.policy_version, '2026-09-01');
    assert.ok(appRow.consented_at, 'consent timestamped in DB');

    const cand = db.prepare('SELECT * FROM candidates WHERE email = ?').get('grace.lee@x.com');
    assert.ok(cand.resume_path, 'resume file stored');
    assert.ok(fs.existsSync(path.join(upDir, cand.resume_path)), 'resume file on disk');

    // second application for the same candidate (multi-apply export coverage)
    const apply2 = await (await jsonReq(base, 'POST', '/api/public/applications', null, {
      job_id: job2Id, name: 'Grace Lee', email: 'grace.lee@x.com', consent: true,
    })).json();
    assert.ok(apply2.tracking_token);

    // --- export ---
    const missing = await jsonReq(base, 'POST', '/api/public/export', null, { email: 'nobody@x.com' });
    assert.equal(missing.status, 404);

    const exported = await (await jsonReq(base, 'POST', '/api/public/export', null, { email: 'grace.lee@x.com' })).json();
    assert.equal(exported.candidate.name, 'Grace Lee');
    assert.equal(exported.candidate.resume_filename, 'grace.txt');
    assert.equal(exported.applications.length, 2, 'both applications exported');
    assert.ok(exported.erasure_token, 'export grants an erasure token');
    assert.ok(exported.applications.every((a) => a.consent?.consented_at), 'consent metadata in export');

    // --- erasure token gate ---
    const badToken = await jsonReq(base, 'POST', '/api/public/erasure', null, { email: 'grace.lee@x.com', erasure_token: 'not-a-real-token' });
    assert.equal(badToken.status, 403, 'erasure requires a valid token (no email-only delete)');

    const erasure = await (await jsonReq(base, 'POST', '/api/public/erasure', null, {
      email: 'grace.lee@x.com', erasure_token: exported.erasure_token,
    })).json();
    assert.ok(erasure.ok);
    assert.equal(erasure.affected_applications, 2);

    assert.equal(db.prepare('SELECT COUNT(*) n FROM candidates WHERE email = ?').get('grace.lee@x.com').n, 0, 'candidate erased');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM applications').get().n, 0, 'applications erased');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM application_answers').get().n, 0, 'answers erased (cascade)');
    assert.ok(!fs.existsSync(path.join(upDir, cand.resume_path)), 'resume file deleted from disk');

    const auditErase = db.prepare("SELECT * FROM audit_log WHERE action = 'candidate.erasure'").all();
    assert.equal(auditErase.length, 1);
    assert.ok(auditErase[0].detail.includes('grace.lee@x.com'));
    assert.equal(auditErase[0].company_id, co);

    // --- recruiter audit endpoint ---
    await jsonReq(base, 'POST', '/api/auth/login', null, { email: 'raquel@privacy.co', password: 'pw' });
    const j2 = db.prepare('SELECT id FROM jobs WHERE company_id = ?').all(co)[0];
    const createdId = db
      .prepare('INSERT INTO candidates (company_id, name, email) VALUES (?,?,?)')
      .run(co, 'Temp Cand', 'temp.cand@x.com').lastInsertRowid;
    const appRec = await (await jsonReq(base, 'POST', '/api/applications', token, { job_id: j2.id, candidate_id: createdId })).json();
    assert.ok(appRec.id);
    await jsonReq(base, 'PATCH', `/api/applications/${appRec.id}/status`, token, { status: 'interview' });

    const audit = await (await jsonReq(base, 'GET', '/api/audit', token)).json();
    assert.ok(audit.length >= 3, 'audit log has login + create + status entries');
    const statusEntries = audit.filter((a) => a.action === 'application.status' && a.detail.includes(`#${appRec.id}`));
    assert.equal(statusEntries.length, 1);
    assert.equal(statusEntries[0].user_email, 'raquel@privacy.co');
    assert.ok(audit.some((a) => a.action === 'application.create'));
    assert.ok(audit.some((a) => a.action === 'auth.login'));
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});