# TalentFlow

A locally hosted, Workday-style hiring tool that stores your candidate pool and jobs, then **scores and ranks the best candidates** for each role automatically.

## Features

- **Candidate & job management** — add, edit, archive, delete candidates and jobs
- **Automatic candidate ranking** — every candidate is scored against every job
- **Transparent scoring** — see the breakdown behind each match (skills, experience fit, years)
- **Shortlists & pipeline** — move candidates from *matched* → *in review* → *interview* → *hired*
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
│   │   └── seed.js       # sample companies/users/candidates/jobs
│   ├── tests/            # node:test units + API integration
│   └── data/talentflow.db
├── client/
│   └── src/              # React app (Vite), plain CSS
└── package.json
```

## API overview

All routes (except `POST /api/auth/login` and `/api/health`) require `Authorization: Bearer <token>`.

- `POST /api/auth/login` — get a JWT (`demo@acmetalent.com` / `password`)
- `GET|POST /api/candidates`, `PUT|DELETE /api/candidates/:id`
- `GET|POST /api/jobs`, `PUT|DELETE /api/jobs/:id`
- `GET /api/jobs/:id/matches` — ranked candidates for one job (with score breakdowns)
- `GET /api/matches/all` — best candidates per job
- `GET|POST /api/applications`, `PATCH /api/applications/:id/status`

## Notes

- Database lives at `server/data/talentflow.db` (gitignored). Delete it and re-run `npm run db:seed` to reset.
- The dev JWT secret is `local-dev-secret-change-me` — set `JWT_SECRET` before exposing anything publicly.