# TalentFlow

A locally hosted, Workday-style hiring tool that stores your candidate pool and jobs, then **scores and ranks the best candidates** for each role automatically.

## Features

- **Candidate & job management** — add, edit, archive, delete candidates and jobs
- **Automatic candidate ranking** — every candidate is scored against every job
- **Transparent scoring** — see the breakdown behind each match (skills, experience fit, years)
- **Shortlists & pipeline** — move candidates from *matched* → *in review* → *interview* → *hired*
- **Public candidate portal** — a shareable, no-login careers page: browse open roles, one-click apply, auto-fill from an uploaded resume, complete Workday-style EEO self-identification, and track application status with a private link
- **Screening questions** — recruiters build a reusable question library (short answer, paragraph, single/multiple choice) and configure per job which questions are asked, required, and in what order; answers show up in the recruiter Applications view only
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

## Scripts (from repo root)

| Command | What it does |
|---------|--------------|
| `npm run server` | API only (http://localhost:4000) |
| `npm run client` | Vite web app only (http://localhost:5173) |
| `npm run dev` | Both together |
| `npm run db:seed` | Re-seed sample data (safe: skips existing rows) |
| `npm test` | Server unit + API tests |

## Project layout

```
talentflow/
├── server/
│   ├── src/
│   │   ├── index.js      # Express app + all REST routes
│   │   ├── db.js         # SQLite schema + connection
│   │   ├── matching.js   # pure scoring / ranking logic
│   │   ├── auth.js       # JWT signing + middleware
│   │   ├── questionnaire.js # EEO / self-identification question config
│   │   ├── screening.js   # screening-question library + per-job config + answer sanitizing
│   │   ├── resume.js     # resume text extraction (.txt/.docx/.pdf) + field auto-fill heuristics
│   │   └── seed.js       # sample companies/users/candidates/jobs
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
- `GET|POST /api/screening/questions`, `PUT|DELETE /api/screening/questions/:id` — company screening-question library
- `GET|PUT /api/jobs/:id/screening` — per-job screening config (inherit company defaults or override)
- `GET|POST /api/applications`, `PATCH /api/applications/:id/status`

### Public portal routes (no auth)

- `GET /api/public/jobs` — open roles (company-internal fields stripped, includes that job's screening questions)
- `GET /api/public/jobs/:id` — single open role
- `GET /api/public/questionnaire` — EEO / self-identification questions (Workday-style, privacy banner included)
- `POST /api/public/resume/parse` — upload a resume (`.pdf`, `.docx`, `.txt`, max 5 MB) and get back auto-filled contact/skills/summary fields
- `POST /api/public/applications` — apply (multipart): candidate details + optional `resume` file + optional `screening` JSON (plus `questionnaire` JSON). Auto-creates the candidate if unknown; a duplicate application returns the existing tracking token as `409`
- `GET /api/public/applications/:token` — application status by private tracking link
- `POST /api/public/applications/lookup` — list applications for an email address

Internal match scores are never exposed to candidates — the portal shows stage status only. Screening answers are returned to recruiters (`GET /api/applications`) with labelled questions; EEO answers are stored server-side (compliance) but never returned by recruiter or portal routes.

## Notes

- Database lives at `server/data/talentflow.db` (gitignored). Delete it and re-run `npm run db:seed` to reset.
- The dev JWT secret is `local-dev-secret-change-me` — set `JWT_SECRET` before exposing anything publicly.