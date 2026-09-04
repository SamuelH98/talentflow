import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDb } from '../src/db.js';
import bcrypt from 'bcryptjs';
import { signToken } from '../src/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer(dbFile) {
  const { app } = await import('../src/index.js');
  const server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

test('core CRUD and matching through the API', async () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-'));
  const dbFile = path.join(dbDir, 'test.db');
  process.env.DB_PATH = dbFile;
  process.env.NODE_ENV = 'test';

  const db = createDb(dbFile);
  const co = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Test Co').lastInsertRowid;
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Recruiter', 'r@test.com', bcrypt.hashSync('pw', 10), 'recruiter'
  );
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('r@test.com');
  const token = signToken(user);
  const auth = { Authorization: `Bearer ${token}` };

  const { server, base } = await startServer(dbFile);

  try {
    // login
    const login = await (await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'r@test.com', password: 'pw' }),
    })).json();
    assert.ok(login.token);

    // auth required
    const unauth = await fetch(`${base}/api/candidates`);
    assert.equal(unauth.status, 401);

    // create job
    const jobRes = await (await fetch(`${base}/api/jobs`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Backend Dev', skills: ['Node.js', 'PostgreSQL'], years_required: 3, requirements: ['Build APIs'] }),
    })).json();
    assert.ok(jobRes.id);

    // create candidate
    const candRes = await (await fetch(`${base}/api/candidates`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada Lovelace', skills: ['Node.js', 'PostgreSQL'], years_experience: 5 }),
    })).json();
    assert.ok(candRes.id);

    // matches
    const match = await (await fetch(`${base}/api/jobs/${jobRes.id}/matches`, { headers: auth })).json();
    assert.equal(match.candidates.length, 1);
    assert.equal(match.candidates[0].name, 'Ada Lovelace');
    assert.ok(match.candidates[0].score >= 70, `expected good score, got ${match.candidates[0].score}`);
  } finally {
    server.close();
    db.close();
  }
});