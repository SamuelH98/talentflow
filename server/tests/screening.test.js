import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createDb } from '../src/db.js';
import { signToken } from '../src/auth.js';

function jsonReq(base, method, path, token, body) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const HEARD = { label: 'How did you hear about us?', type: 'text' };
const WORK_AUTH = {
  label: 'Legally authorized to work?',
  type: 'single',
  options: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ],
};
const STACK = {
  label: 'Which stacks have you used?',
  type: 'multiple',
  options: [
    { value: 'react', label: 'React' },
    { value: 'node', label: 'Node' },
    { value: 'go', label: 'Go' },
  ],
};
const PROUD = { label: 'Tell us about a project', type: 'paragraph' };

test('screening questions: library, per-job config, answers', async (t) => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-screen-'));
  process.env.DB_PATH = path.join(dbDir, 's.db');
  process.env.UPLOADS_DIR = path.join(dbDir, 'uploads');
  process.env.NODE_ENV = 'test';
  const db = createDb();
  const co = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Screening Co').lastInsertRowid;
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Recruiter', 'r@screening.com', bcrypt.hashSync('pw', 10), 'recruiter'
  );
  const token = signToken(db.prepare('SELECT * FROM users WHERE email = ?').get('r@screening.com'));
  const { app } = await import('../src/index.js');
  const server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const createQ = async (body) => {
    const res = await jsonReq(base, 'POST', '/api/screening/questions', token, body);
    return { status: res.status, json: await res.json() };
  };

  let heardId;
  let workAuthId;
  let stackId;

  await t.test('library CRUD, defaults, validation, isolation', async () => {
    const heard = await createQ({ ...HEARD, default_enabled: 1, default_required: 1 });
    assert.equal(heard.status, 201);
    heardId = heard.json.id;
    workAuthId = (await createQ({ ...WORK_AUTH, default_enabled: 1, default_required: 1 })).json.id;
    stackId = (await createQ({ ...STACK, default_enabled: 1 })).json.id;
    const proud = await createQ({ ...PROUD, default_enabled: 0 });

    assert.equal((await createQ({})).status, 400);
    assert.equal((await createQ({ ...WORK_AUTH, options: [] })).status, 400, 'choice needs 2+ options');
    assert.equal(
      (await createQ({ ...WORK_AUTH, options: [{ value: 'x', label: 'X' }, { value: 'x', label: 'Y' }] })).status,
      400,
      'duplicate option values rejected'
    );
    assert.equal((await createQ({ ...WORK_AUTH, options: [{ value: '' , label: 'X' }, { value: 'y', label: 'Y' }] })).status, 400, 'blank option value rejected');

    const list = await (await jsonReq(base, 'GET', '/api/screening/questions', token)).json();
    assert.equal(list.length, 4);
    const byLabel = (l) => list.find((q) => q.label === l);
    assert.equal(byLabel('How did you hear about us?').default_required, true);
    assert.equal(byLabel('How did you hear about us?').type, 'text');
    assert.equal(byLabel('Which stacks have you used?').options.length, 3);
    assert.equal(byLabel('Which stacks have you used?').jobs_using, 0);

    const updated = await (await jsonReq(base, 'PUT', `/api/screening/questions/${heardId}`, token, { ...HEARD, default_enabled: 1, default_required: 0 })).json();
    assert.equal(updated.default_required, false);
    assert.equal((await jsonReq(base, 'DELETE', `/api/screening/questions/${proud.json.id}`, token)).status, 200);
    assert.equal((await (await jsonReq(base, 'GET', '/api/screening/questions', token)).json()).length, 3);

    const co2 = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Other Co').lastInsertRowid;
    db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
      co2, 'R2', 'r2@other.com', bcrypt.hashSync('pw', 10), 'recruiter'
    );
    const token2 = signToken(db.prepare('SELECT * FROM users WHERE email = ?').get('r2@other.com'));
    assert.equal((await (await jsonReq(base, 'GET', '/api/screening/questions', token2)).json()).length, 0);
    assert.equal((await jsonReq(base, 'PUT', `/api/screening/questions/${heardId}`, token2, HEARD)).status, 404, 'cannot edit another company\'s question');
  });

  await t.test('per-job config: defaults inherit, materialize, public reflects', async () => {
    const jobId = db.prepare(
      'INSERT INTO jobs (company_id, title, department, location, status) VALUES (?,?,?,?,?)'
    ).run(co, 'Backend Engineer', 'Engineering', 'Remote', 'open').lastInsertRowid;

    // editor view: all library questions with their default flags
    const inherited = await (await jsonReq(base, 'GET', `/api/jobs/${jobId}/screening`, token)).json();
    assert.equal(inherited.inherited, true);
    assert.deepEqual(inherited.questions.map((q) => q.id), [heardId, workAuthId, stackId]);
    assert.equal(inherited.questions.find((q) => q.id === heardId).enabled, true);
    assert.equal(inherited.questions.find((q) => q.id === workAuthId).required, true);

    // public job lists only the job's EFFECTIVE questions (default-enabled ones)
    const pub = await (await fetch(`${base}/api/public/jobs/${jobId}`)).json();
    assert.deepEqual(pub.screening_questions.map((q) => q.id), [heardId, workAuthId, stackId]);
    assert.equal(pub.screening_questions.find((q) => q.id === workAuthId).required, true);

    const res = await jsonReq(base, 'PUT', `/api/jobs/${jobId}/screening`, token, {
      questions: [
        { question_id: stackId, required: true, enabled: true },
        { question_id: workAuthId, required: false, enabled: true },
      ],
    });
    assert.equal(res.status, 200);
    const saved = await res.json();
    assert.equal(saved.inherited, false);
    assert.deepEqual(saved.questions.map((q) => q.id), [stackId, workAuthId]);

    const after = await (await jsonReq(base, 'GET', `/api/jobs/${jobId}/screening`, token)).json();
    assert.equal(after.inherited, false);
    assert.equal(after.questions[0].required, true);
    assert.equal(after.questions[1].required, false);

    const pub2 = await (await fetch(`${base}/api/public/jobs/${jobId}`)).json();
    assert.deepEqual(pub2.screening_questions.map((q) => q.id), [stackId, workAuthId]);

    assert.equal(
      (await jsonReq(base, 'PUT', `/api/jobs/${jobId}/screening`, token, { questions: [{ question_id: 99999, enabled: true, required: false }] })).status,
      400
    );
    assert.equal((await jsonReq(base, 'GET', '/api/jobs/404/screening', token)).status, 404);
  });

  await t.test('apply answers validated, stored per-question, recruiter-only visibility', async () => {
    const jobId = db.prepare(
      'INSERT INTO jobs (company_id, title, department, location, status) VALUES (?,?,?,?,?)'
    ).run(co, 'ML Engineer', 'Data', 'Seattle', 'open').lastInsertRowid;
    await jsonReq(base, 'PUT', `/api/jobs/${jobId}/screening`, token, {
      questions: [
        { question_id: workAuthId, required: true, enabled: true },
        { question_id: stackId, required: true, enabled: true },
        { question_id: heardId, required: false, enabled: true },
      ],
    });

    const apply = (body) => jsonReq(base, 'POST', '/api/public/applications', null, body);
    const blockedRes = await apply({ job_id: jobId, name: 'Bob', email: 'bob@x.com', consent: true, screening: { [workAuthId]: 'yes' } });
    assert.equal(blockedRes.status, 422);
    const blocked = await blockedRes.json();
    assert.deepEqual(blocked.missing, ['Which stacks have you used?']);

    const noConsentRes = await apply({ job_id: jobId, name: 'Bob', email: 'bob@x.com', screening: { [workAuthId]: 'yes', [stackId]: ['react'] } });
    assert.equal(noConsentRes.status, 422, 'apply without consent is rejected');

    const ok = await (await apply({
      job_id: jobId, name: 'Bob', email: 'bob@x.com',
      consent: true,
      screening: {
        [workAuthId]: 'yes',
        [stackId]: ['react', 'not-a-stack'],
        99999: 'spoofed',
      },
      questionnaire: JSON.stringify({ current_employee: 'no' }),
    })).json();
    assert.ok(ok.tracking_token);

    const appRow = db.prepare('SELECT * FROM applications WHERE tracking_token = ?').get(ok.tracking_token);
    const stored = JSON.parse(db.prepare('SELECT data FROM application_answers WHERE application_id = ?').get(appRow.id).data);
    assert.deepEqual(stored.screening, { [workAuthId]: 'yes', [stackId]: ['react'] });
    assert.equal(stored.eeo.current_employee, 'no', 'EEO still stored separately');

    const apps = await (await jsonReq(base, 'GET', '/api/applications', token)).json();
    const mine = apps.find((a) => a.id === appRow.id);
    assert.ok(mine);
    assert.deepEqual(mine.screening_answers.map((s) => s.question), [
      'Legally authorized to work?',
      'Which stacks have you used?',
    ]);
    assert.equal(mine.screening_answers.find((s) => s.question === 'Legally authorized to work?').answer, 'Yes');
    assert.equal(mine.screening_answers.find((s) => s.question === 'Which stacks have you used?').answer, 'React');
    assert.equal(mine.screening_answers.some((s) => s.question === 'How did you hear about us?'), false, 'unanswered optional not listed');
    assert.ok(!Object.keys(mine).some((k) => k.toLowerCase().includes('eeo')), 'EEO never in recruiter application payload');

    const status = await (await fetch(`${base}/api/public/applications/${ok.tracking_token}`)).json();
    assert.ok(!('screening' in status) && !('answers' in status));
    assert.ok(status.consent, 'status exposes consent metadata');
    assert.ok(status.consent.consented_at, 'consent timestamp recorded');
    assert.equal(appRow.policy_version, '2026-09-01');

    // deleted questions: stored answers still surface with a fallback label
    const goneId = db.prepare('INSERT INTO screening_questions (company_id, label, type, options) VALUES (?,?,?,?)').run(co, 'Gone', 'text', '[]').lastInsertRowid;
    db.prepare('UPDATE application_answers SET data = ? WHERE application_id = ?').run(
      JSON.stringify({ screening: { [goneId]: 'legacy', [workAuthId]: 'yes' } }), appRow.id
    );
    const relabeled = await (await jsonReq(base, 'GET', '/api/applications', token)).json();
    const goneRow = relabeled.find((a) => a.id === appRow.id).screening_answers.find((s) => s.question === `Question #${goneId}`);
    assert.ok(goneRow && goneRow.answer === 'legacy');
  });

  server.close();
});