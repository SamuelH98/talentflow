# TalentFlow

A locally hosted, Workday-style hiring tool that stores your candidate pool and jobs, then **scores and ranks the best candidates** for each role automatically — with no database server, no cloud account, and no external AI API. Runs in under a minute.

[License: AGPL-3.0](LICENSE) · [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Feature matrix](docs/FEATURES.md)

## Features

- **Candidate & job management** — add, edit, archive, delete candidates and jobs
- **Automatic candidate ranking** — every candidate is scored against every job
- **Transparent scoring** — see the breakdown behind each match (skills, experience fit, years)
- **Shortlists & pipeline** — move candidates from *matched* → *in review* → *interview* → *hired*
- **Public candidate portal** — a shareable, no-login careers page: browse open roles, one-click apply, auto-fill from an uploaded resume, complete Workday-style EEO self-identification, and track application status with a private link
- **Screening questions** — recruiters build a reusable question library (short answer, paragraph, single/multiple choice) and configure per job which questions are asked, required, and in what order; answers show up in the recruiter Applications view only
- **Candidate consent + privacy** — applications record explicit consent with a timestamp and policy version; candidates can export a portable copy of their data (JSON + resume) and request full erasure with a proof token, all from the public portal. Recruiter actions are kept in a company-scoped audit log.
- **Dark mode** — recruiter UI follows the OS preference with a manual sun/moon toggle; the public portal stays light
- **Multi-company** — data is scoped per company (log in as different companies and see only your data)
- **Locally hosted** — SQLite file database, nothing leaves your machine; no external AI API required, works fully offline

## Scoring model

For each (job, candidate) pair:

| Component | Weight | What it measures |
|-----------|--------|------------------|
| Skill match | 50% | Overlap between job required skills and candidate skills (with synonyms, e.g. JS ↔ JavaScript ↔ Node) |
| Experience fit | 30% | How well the candidate's summary / experience / resume text matches the job's requirement phrases |
| Years required | 20% | Candidate years relative to the job's required years (capped at 100%) |

Total score is 0–100. Scores are computed locally by `server/src/matching.js`.

## Quick start

Requires **Node.js ≥ 20** (tested on 24).

```bash
npm install             # root (concurrently)
npm run setup           # installs server + client deps
npm run db:seed         # creates the SQLite DB with sample data
npm run dev             # starts API (:4000) + web app (:5173)
```

Open http://localhost:5173 and sign in with:

- **Email:** `demo@acmetalent.com`
- **Password:** `password`

**Candidate portal** (no login needed): http://localhost:5173/#/portal — browse open jobs, apply in under a minute, and track applications. After applying you get a private tracking link (`#/portal/status/<token>`) you can keep or share. In the apply form you can upload a `.pdf`, `.docx`, or `.txt` resume and the portal auto-fills your details locally (best-effort — review before submitting; scanned/image PDFs can't be read). Each job may also ask screening questions configured by the recruiter (answers are reviewed by the hiring team and are **not** shown to other candidates). EEO / self-identification questions follow the standard Workday/OFCCP format; answers are stored for compliance reporting but are deliberately **not visible** in any recruiter pipeline view.

## Quick start — Docker

```bash
docker compose up --build
```

Brings up the whole app on http://localhost:4000. On first run set `SEED_ON_BOOT=1` in your environment (or `.env`) to load demo data and a login, or create an account via the API.

```bash
# optional demo data on first boot
SEED_ON_BOOT=1 JWT_SECRET=$(openssl rand -hex 32) docker compose up --build
```

Data and uploaded resumes live in the named `talentflow-data` volume (SQLite file — delete the volume to reset).

## Quick start — from source

Requires **Node.js ≥ 20** (tested on 24).

```bash
npm install             # root (concurrently)
npm run setup           # installs server + client deps
npm run db:seed         # creates the SQLite DB with sample data
npm run dev             # starts API (:4000) + web app (:5173)
```

Open http://localhost:5173 and sign in with:

- **Email:** `demo@acmetalent.com`
- **Password:** `password`

## Production mode (single origin)

`cd server && npm run start:prod` builds the client and serves **everything** — API and the React app, SPA routing included — from one Express server on :4000. No separate web server or CORS needed.

Useful environment variables (all optional):

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PORT` | `4000` | HTTP port |
| `DB_PATH` | `server/data/talentflow.db` | SQLite database file location |
| `UPLOADS_DIR` | `server/data/uploads` | Where uploaded resumes are stored |
| `JWT_SECRET` | dev-only fallback | Signing key for login tokens — **set a strong random value in production** (the server warns in `NODE_ENV=production` if unset) |
| `NODE_ENV` | development | `production` enables prod behaviors (`JWT_SECRET` guard, static serving) |
| `SEED_ON_BOOT` | off | `1`/`true` seeds demo data idempotently at startup — handy for a hosted demo that should reset cleanly |
| `SERVE_CLIENT` | `on` | Set to `off` to run API only |

## Scripts (from repo root)

| Command | What it does |
|---------|--------------|
| `npm run server` | API only (http://localhost:4000) |
| `npm run client` | Vite web app only (http://localhost:5173) |
| `npm run dev` | Both together |
| `npm run build` | Build the client into `client/dist` |
| `npm run db:seed` | Re-seed sample data (safe: skips existing rows) |
| `npm test` | Server unit + API tests |
| `cd server && npm run start:prod` | Build client + serve app and API from one port |

## Project layout

```
talentflow/
├── Dockerfile          # multi-stage build (client → server deps → slim runtime)
├── docker-compose.yml  # one-command startup with a data volume
├── docs/FEATURES.md    # ATS capability matrix + comparison with open peers
├── server/
│   ├── src/
│   │   ├── index.js      # Express app + all REST routes + prod static serving
│   │   ├── db.js         # SQLite schema + connection
│   │   ├── matching.js   # pure scoring / ranking logic
│   │   ├── auth.js       # JWT signing + middleware (+ production secret guard)
│   │   ├── questionnaire.js # EEO / self-identification question config
│   │   ├── screening.js   # screening-question library + per-job config + answer sanitizing
│   │   ├── resume.js     # resume text extraction (.txt/.docx/.pdf) + field auto-fill heuristics
│   │   └── seed.js       # sample companies/users/candidates/jobs (reusable for SEED_ON_BOOT)
│   ├── tests/            # node:test units + API integration
│   └── data/talentflow.db
├── client/
│   └── src/              # React app (Vite), plain CSS
└── package.json
```

## API overview

All routes (except `POST /api/auth/login`, `/api/health`, and the `/api/public/*` portal routes) require `Authorization: Bearer <token>`.

- `POST /api/auth/login` — get a JWT (`demo@acmetalent.com` / `password`)
- `GET|POST /api/candidates`, `PUT|DELETE /api/candidates/:id`
- `GET|POST /api/jobs`, `PUT|DELETE /api/jobs/:id`
- `GET /api/jobs/:id/matches` — ranked candidates for one job (with score breakdowns)
- `GET /api/matches/all` — best candidates per job
- `GET /api/search?q=` — global search across candidates, jobs, and applications for the company (name/email/title/location/skills; job title/location/description; application by candidate or job name)
- `GET|POST /api/screening/questions`, `PUT|DELETE /api/screening/questions/:id` — company screening-question library
- `GET|PUT /api/jobs/:id/screening` — per-job screening config (inherit company defaults or override)
- `GET|POST /api/applications`, `PATCH /api/applications/:id/status`
- `PUT /api/company/brand` — set the company brand color (`{ brand_color: "#rrggbb" }`); **admin-only** (403 for recruiters)
- `PUT /api/company/settings` — update company profile (`{ name?, brand_color?, nav_color?, accent_color? }`); **admin-only**, name 1–120 chars, `brand_color`/`nav_color`/`accent_color` validated as `#rrggbb` (or `null` to clear a color back to the theme default)
- `PUT /api/company/logo` — upload/replace the company logo (multipart `logo`, png/jpg/jpeg/gif/webp/svg/avif, max 5 MB); **admin-only**
- `DELETE /api/company/logo` — remove the company logo; **admin-only**

### Public portal routes (no auth)

- `GET /api/public/jobs` — open roles (company-internal fields stripped, includes that job's screening questions)
- `GET /api/public/company` — public company brand (`id`, `name`, `brand_color`, `logo_path`, `nav_color`, `accent_color`) shown as the portal logo/heading
- `GET /api/company/logo` — public company logo image (no auth) with a short cache header
- `GET /api/public/jobs/:id` — single open role
- `GET /api/public/questionnaire` — EEO / self-identification questions (Workday-style, privacy banner included)
- `POST /api/public/resume/parse` — upload a resume (`.pdf`, `.docx`, `.txt`, max 5 MB) and get back auto-filled contact/skills/summary fields
- `POST /api/public/applications` — apply (multipart): candidate details + optional `resume` file + optional `screening` JSON (plus `questionnaire` JSON). Requires `consent=true` (422 otherwise); the application stores `consented_at` and the policy version. Auto-creates the candidate if unknown; a duplicate application returns the existing tracking token as `409`
- `GET /api/public/applications/:token` — application status by private tracking link
- `POST /api/public/applications/lookup` — list applications for an email address
- `GET /api/public/privacy` — privacy notice and current policy version
- `POST /api/public/export` — data subject access request: all data stored for an email (candidate, applications, answers, consent records, resume filename) plus an `erasure_token` proof
- `POST /api/public/erasure` — right-to-be-forgotten: `{ email, erasure_token }` deletes the candidate, their applications/answers, and any stored resume file (403 on a wrong token)

Recruiter routes (auth required): `GET /api/audit?limit=` returns the company-scoped activity log (sign-ins, candidate/job changes, stage changes, self-service erasures).

Internal match scores are never exposed to candidates — the portal shows stage status only. Screening answers are returned to recruiters (`GET /api/applications`) with labelled questions; EEO answers are stored server-side (compliance) but never returned by recruiter or portal routes.

## Notes

- The database file is `server/data/talentflow.db` by default (gitignored); use `DB_PATH` to relocate. Delete it and re-run `npm run db:seed` to reset.
- The dev JWT secret is `local-dev-secret-change-me` — set `JWT_SECRET` before exposing anything publicly (the server logs a warning in production if you forget).
- WAL mode is on; three `-wal`/`-shm` files accompany the DB file — normal.