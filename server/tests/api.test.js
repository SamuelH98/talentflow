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

test('company brand color requires an admin; recruiters are forbidden', async () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-brand-'));
  const dbFile = path.join(dbDir, 'test.db');
  process.env.DB_PATH = dbFile;
  process.env.NODE_ENV = 'test';

  const db = createDb(dbFile);
  const co = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Brand Co').lastInsertRowid;
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Admin', 'admin@test.com', bcrypt.hashSync('pw', 10), 'admin'
  );
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Recruiter', 'rec@test.com', bcrypt.hashSync('pw', 10), 'recruiter'
  );
  const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@test.com');
  const recruiter = db.prepare('SELECT * FROM users WHERE email = ?').get('rec@test.com');
  const adminAuth = { Authorization: `Bearer ${signToken(admin)}` };
  const recruiterAuth = { Authorization: `Bearer ${signToken(recruiter)}` };

  const { server, base } = await startServer(dbFile);

  try {
    // unauthenticated is rejected
    const unauth = await fetch(`${base}/api/company/brand`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_color: '#e11d48' }),
    });
    assert.equal(unauth.status, 401);

    // a plain recruiter is forbidden
    const forbidden = await fetch(`${base}/api/company/brand`, {
      method: 'PUT', headers: { ...recruiterAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_color: '#e11d48' }),
    });
    assert.equal(forbidden.status, 403);

    // invalid hex is rejected for admins too
    const invalid = await fetch(`${base}/api/company/brand`, {
      method: 'PUT', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_color: 'indigo' }),
    });
    assert.equal(invalid.status, 400);

    // valid admin update persists and appears in public company endpoint
    const put = await (await fetch(`${base}/api/company/brand`, {
      method: 'PUT', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_color: '#16a34a' }),
    })).json();
    assert.equal(put.company.brand_color, '#16a34a');

    const pub = await (await fetch(`${base}/api/public/company`)).json();
    assert.equal(pub.name, 'Brand Co');
    assert.equal(pub.brand_color, '#16a34a');

    // /me carries the brand color and role
    const me = await (await fetch(`${base}/api/me`, { headers: adminAuth })).json();
    assert.equal(me.user.role, 'admin');
    assert.equal(me.user.company.brand_color, '#16a34a');

    // company settings: name + brand, admin-only
    const forbiddenSettings = await fetch(`${base}/api/company/settings`, {
      method: 'PUT', headers: { ...recruiterAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Co' }),
    });
    assert.equal(forbiddenSettings.status, 403);

    const badName = await fetch(`${base}/api/company/settings`, {
      method: 'PUT', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    assert.equal(badName.status, 400);

    const settings = await (await fetch(`${base}/api/company/settings`, {
      method: 'PUT', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  Renamed Co  ', brand_color: '#7c3aed', nav_color: '#0f172a', accent_color: '#16a34a' }),
    })).json();
    assert.equal(settings.company.name, 'Renamed Co');
    assert.equal(settings.company.brand_color, '#7c3aed');
    assert.equal(settings.company.nav_color, '#0f172a');
    assert.equal(settings.company.accent_color, '#16a34a');

    // bad hex for nav_color is rejected
    const badHex = await fetch(`${base}/api/company/settings`, {
      method: 'PUT', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nav_color: 'red' }),
    });
    assert.equal(badHex.status, 400);

    const pubAfter = await (await fetch(`${base}/api/public/company`)).json();
    assert.equal(pubAfter.name, 'Renamed Co');
    assert.equal(pubAfter.brand_color, '#7c3aed');
    assert.equal(pubAfter.nav_color, '#0f172a');
    assert.equal(pubAfter.accent_color, '#16a34a');

    // company logo: upload (admin), served publicly, removable
    const badLogo = await fetch(`${base}/api/company/logo`, {
      method: 'PUT', headers: recruiterAuth,
      body: (() => { const fd = new FormData(); fd.append('logo', new Blob(['x'], { type: 'image/png' }), 'logo.png'); return fd; })(),
    });
    assert.equal(badLogo.status, 403);

    const logoFd = new FormData();
    logoFd.append('logo', new Blob([Buffer.from('fake-png')], { type: 'image/png' }), 'logo.png');
    const logoPut = await (await fetch(`${base}/api/company/logo`, {
      method: 'PUT', headers: adminAuth, body: logoFd,
    })).json();
    assert.ok(logoPut.company.logo_path);

    const logoGet = await fetch(`${base}/api/company/logo`);
    assert.equal(logoGet.status, 200);

    const logoDel = await (await fetch(`${base}/api/company/logo`, {
      method: 'DELETE', headers: adminAuth,
    })).json();
    assert.equal(logoDel.company.logo_path, null);
    assert.equal((await fetch(`${base}/api/company/logo`)).status, 404);
  } finally {
    server.close();
    db.close();
  }
});

test('company branding browser: search, logo-by-id, and logo import', async () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-brand-'));
  const dbFile = path.join(dbDir, 'test.db');
  process.env.DB_PATH = dbFile;
  process.env.NODE_ENV = 'test';
  process.env.UPLOADS_DIR = path.join(dbDir, 'uploads');

  const db = createDb(dbFile);
  const co = db.prepare('INSERT INTO companies (name, brand_color, logo_path) VALUES (?,?,?)').run('Acme Co', '#4f46e5', null).lastInsertRowid;
  const srcCo = db.prepare('INSERT INTO companies (name, brand_color, nav_color, accent_color) VALUES (?,?,?,?)').run('Pine Labs', '#ea580c', '#1c1917', '#f59e0b').lastInsertRowid;
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Recruiter', 'br@test.com', bcrypt.hashSync('pw', 10), 'recruiter'
  );
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Admin', 'ba@test.com', bcrypt.hashSync('pw', 10), 'admin'
  );
  const recruiter = db.prepare('SELECT * FROM users WHERE email = ?').get('br@test.com');
  const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('ba@test.com');
  const recruiterAuth = { Authorization: `Bearer ${signToken(recruiter)}` };
  const adminAuth = { Authorization: `Bearer ${signToken(admin)}` };

  const { server, base } = await startServer(dbFile);

  try {
    // source company gets a logo file on disk
    fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.UPLOADS_DIR, 'pine.svg'), '<svg></svg>');
    db.prepare('UPDATE companies SET logo_path = ? WHERE id = ?').run('pine.svg', srcCo);

    // search is admin-only
    const recruiterSearch = await fetch(`${base}/api/companies/search?q=pine`, { headers: recruiterAuth });
    assert.equal(recruiterSearch.status, 403);
    const noAuth = await fetch(`${base}/api/companies/search?q=pine`);
    assert.equal(noAuth.status, 401);

    // search finds the other company and exposes its branding, but never self
    const search = await (await fetch(`${base}/api/companies/search?q=pine`, { headers: adminAuth })).json();
    assert.equal(search.length, 1);
    assert.equal(search[0].id, srcCo);
    assert.equal(search[0].name, 'Pine Labs');
    assert.equal(search[0].brand_color, '#ea580c');
    assert.equal(search[0].nav_color, '#1c1917');
    assert.equal(search[0].accent_color, '#f59e0b');
    assert.equal(search[0].logo_path, 'pine.svg');

    const selfOnly = await (await fetch(`${base}/api/companies/search`, { headers: adminAuth })).json();
    assert.ok(!selfOnly.some((c) => c.id === co), 'own company excluded');

    // logo served by id
    const logoById = await fetch(`${base}/api/company/logo?company=${srcCo}`);
    assert.equal(logoById.status, 200);
    assert.equal((await logoById.text()), '<svg></svg>');
    const noLogo = await fetch(`${base}/api/company/logo?company=${co}`);
    assert.equal(noLogo.status, 404);

    // import failures: unknown company, source without logo, recruiter
    const unknown = await fetch(`${base}/api/company/logo/import`, {
      method: 'POST', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: 9999 }),
    });
    assert.equal(unknown.status, 404);
    const srcNoLogo = await (await fetch(`${base}/api/company/logo/import`, {
      method: 'POST', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: co }),
    })).json();
    assert.match(srcNoLogo.error, /no logo/i);
    const recruiterImport = await fetch(`${base}/api/company/logo/import`, {
      method: 'POST', headers: { ...recruiterAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: srcCo }),
    });
    assert.equal(recruiterImport.status, 403);

    // import copies logo + resets to fresh stored name
    const imported = await (await fetch(`${base}/api/company/logo/import`, {
      method: 'POST', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: srcCo }),
    })).json();
    assert.ok(imported.company.logo_path);
    assert.notEqual(imported.company.logo_path, 'pine.svg');
    assert.equal((await fetch(`${base}/api/company/logo`)).status, 200);
  } finally {
    server.close();
    db.close();
    delete process.env.UPLOADS_DIR;
  }
});

test('company lookup + adopt: finds any company, applies logo, title, and theme color', async () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-adopt-'));
  const dbFile = path.join(dbDir, 'test.db');
  process.env.DB_PATH = dbFile;
  process.env.NODE_ENV = 'test';
  process.env.UPLOADS_DIR = path.join(dbDir, 'uploads');

  const db = createDb(dbFile);
  const co = db.prepare('INSERT INTO companies (name) VALUES (?)').run('My Co').lastInsertRowid;
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Recruiter', 'adr@test.com', bcrypt.hashSync('pw', 10), 'recruiter'
  );
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Admin', 'ada@test.com', bcrypt.hashSync('pw', 10), 'admin'
  );
  const recruiter = db.prepare('SELECT * FROM users WHERE email = ?').get('adr@test.com');
  const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('ada@test.com');
  const recruiterAuth = { Authorization: `Bearer ${signToken(recruiter)}` };
  const adminAuth = { Authorization: `Bearer ${signToken(admin)}` };

  // Stub the outbound web calls so tests stay offline and deterministic.
  const svgLogo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ea580c"/></svg>');
  const realFetch = globalThis.fetch;
  const fakeResponse = (payload, { contentType = 'application/json', status = 200 } = {}) => ({
    ok: status < 400, status,
    headers: { get: () => contentType },
    json: async () => payload,
    arrayBuffer: async () => payload,
    text: async () => String(payload),
  });
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.startsWith('http://127.0.0.1') || u.startsWith('http://localhost')) return realFetch(url, options);
    if (u.includes('opensearch')) {
      return fakeResponse(['acme', ['Acme Corporation', 'Acme Recordings'], ['', ''], ['https://en.wikipedia.org/wiki/Acme_Corporation', 'https://en.wikipedia.org/wiki/Acme_Recordings']]);
    }
    if (u.includes('wbsearchentities')) {
      return fakeResponse({ search: [{ id: 'Q1', label: 'Acme Corporation' }] });
    }
    if (u.includes('wbgetentities')) {
      return fakeResponse({ entities: { Q1: { id: 'Q1', claims: { P154: [{ mainsnak: { datavalue: { value: 'Acme_logo.svg' } } }] } } } });
    }
    if (u.includes('prop=pageimages')) {
      return fakeResponse({ query: { pages: { 1: { pageid: 1, title: 'Acme Corporation', original: { source: 'https://upload.wikimedia.org/acme.svg' } } } } });
    }
    if (u.includes('duckduckgo')) {
      return fakeResponse({ AbstractURL: 'https://www.linkedin.com/company/acme-corporation', Results: [] });
    }
    if (u.includes('Special:FilePath') || u.includes('upload.wikimedia.org')) {
      return fakeResponse(svgLogo, { contentType: 'image/svg+xml' });
    }
    return fakeResponse({ error: 'unexpected url ' + u }, { status: 404 });
  };

  const { server, base } = await startServer(dbFile);

  try {
    // guardrails
    assert.equal((await fetch(`${base}/api/company/lookup`, { headers: adminAuth })).status, 400);
    assert.equal((await fetch(`${base}/api/company/lookup?q=acme`, { headers: recruiterAuth })).status, 403);
    assert.equal((await fetch(`${base}/api/company/lookup?q=acme`)).status, 401);

    // lookup returns web-sourced candidates with logo + LinkedIn URL
    const lookup = await (await fetch(`${base}/api/company/lookup?q=acme`, { headers: adminAuth })).json();
    assert.equal(lookup.candidates.length, 2);
    assert.equal(lookup.candidates[0].name, 'Acme Corporation');
    assert.ok(lookup.candidates[0].logoUrl.includes('Special:FilePath/Acme_logo.svg'), 'logo resolved via Wikidata P154');
    assert.equal(lookup.candidates[0].linkedinUrl, 'https://www.linkedin.com/company/acme-corporation');

    // adopt: recruiter blocked, invalid name blocked
    assert.equal((await fetch(`${base}/api/company/adopt`, {
      method: 'POST', headers: { ...recruiterAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Corporation' }),
    })).status, 403);
    assert.equal((await fetch(`${base}/api/company/adopt`, {
      method: 'POST', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  ' }),
    })).status, 400);

    // adopt applies title, downloads+caches the logo, derives brand color, keeps LinkedIn URL
    const adopted = await (await fetch(`${base}/api/company/adopt`, {
      method: 'POST', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Corporation', logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Acme_logo.svg', linkedinUrl: 'https://www.linkedin.com/company/acme-corporation' }),
    })).json();
    assert.equal(adopted.company.name, 'Acme Corporation');
    assert.equal(adopted.company.linkedin_url, 'https://www.linkedin.com/company/acme-corporation');
    assert.equal(adopted.company.brand_color, '#ea580c');
    assert.ok(adopted.company.logo_path);
    assert.equal((await fetch(`${base}/api/company/logo`)).status, 200);

    // adopt with a failing logo fetch must leave the org completely unchanged
    const rejectRes = await fetch(`${base}/api/company/adopt`, {
      method: 'POST', headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Swiss Co', logoUrl: 'https://example.com/broken.png' }),
    });
    assert.equal(rejectRes.status, 502);
    const rejectBody = await rejectRes.json();
    assert.ok(rejectBody.error);
    const still = db.prepare('SELECT * FROM companies WHERE id = ?').get(co);
    assert.equal(still.name, 'Acme Corporation', 'name must not change when logo download fails');
    assert.equal(still.brand_color, '#ea580c', 'brand color must not change when logo download fails');
  } finally {
    globalThis.fetch = realFetch;
    server.close();
    db.close();
    delete process.env.UPLOADS_DIR;
  }
});

test('global search returns candidates, jobs, and applications', async () => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-search-'));
  const dbFile = path.join(dbDir, 'test.db');
  process.env.DB_PATH = dbFile;
  process.env.NODE_ENV = 'test';

  const db = createDb(dbFile);
  const co = db.prepare('INSERT INTO companies (name) VALUES (?)').run('Search Co').lastInsertRowid;
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(
    co, 'Recruiter', 'sr@test.com', bcrypt.hashSync('pw', 10), 'recruiter'
  );
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('sr@test.com');
  const auth = { Authorization: `Bearer ${signToken(user)}` };

  const { server, base } = await startServer(dbFile);

  try {
    // seed a job, candidate, and application
    const job = await (await fetch(`${base}/api/jobs`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Product Designer', skills: ['Figma'], location: 'Berlin' }),
    })).json();
    const cand = await (await fetch(`${base}/api/candidates`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Grace Hopper', title: 'Product Designer', skills: ['Figma'], location: 'Berlin' }),
    })).json();
    const saved = await db.prepare(`
      INSERT INTO applications (candidate_id, job_id, status, score)
      VALUES (?,?,?,?)`).run(cand.id, job.id, 'new', 88);

    const search = await (await fetch(`${base}/api/search?q=designer`, { headers: auth })).json();
    assert.ok(search.jobs.some((j) => j.id === job.id), 'job should match by title');
    assert.ok(search.candidates.some((c) => c.id === cand.id), 'candidate should match by title');

    const byName = await (await fetch(`${base}/api/search?q=hopper`, { headers: auth })).json();
    assert.ok(byName.candidates.some((c) => c.id === cand.id), 'candidate should match by name');

    const byAppl = await (await fetch(`${base}/api/search?q=grace`, { headers: auth })).json();
    assert.ok(byAppl.applications.some((a) => a.id === saved.lastInsertRowid), 'application should match by candidate name');

    const empty = await (await fetch(`${base}/api/search?q=zzzz`, { headers: auth })).json();
    assert.deepEqual(empty.candidates, []);
    assert.deepEqual(empty.jobs, []);
    assert.deepEqual(empty.applications, []);

    const noAuth = await fetch(`${base}/api/search?q=designer`);
    assert.equal(noAuth.status, 401);
  } finally {
    server.close();
    db.close();
  }
});