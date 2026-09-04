# PROJECT_STATE

## Project Overview

### Project Name
TalentFlow — local hiring & candidate-ranking app

### Goal
A locally hosted "Workday-lite" where companies add jobs and candidates, and the app automatically scores/ranks the best candidates per job with transparent match breakdowns.

### Current Status
Complete. All MVP features implemented, tests passing, seed data present, end-to-end verified.

---

## Completed Features

### Feature: Auth (JWT, multi-company scoping)
#### Validation
- API test logs in, verifies 401 without token, and confirms only the right company's data is exposed.
#### Tests Added
- `server/tests/api.test.js` — login, auth required, create job/candidate, match scoring through HTTP.

### Feature: Candidates & Jobs CRUD
#### Validation
- Manual curl checks: create/list/delete candidates and jobs verified against live server.
#### Tests Added
- API test creates a job + candidate and reads them back.

### Feature: Candidate ranking (matching)
#### Validation
- Unit tests cover perfect match, no match, partial match, year scaling, synonym expansion, sorted ordering.
- Live server: Senior Full-Stack Engineer ranks Hannah Schmidt 85, Sara Chen 80 at top of 10 candidates.
#### Tests Added
- `server/tests/matching.test.js` — 8 unit tests on `scoreCandidate` / `rankCandidates` / `parseSkills`.

### Feature: Shortlists / applications pipeline
#### Validation
- API endpoints for create + status update verified manually.

### Feature: Seed data
#### Validation
- `npm run db:seed` creates 1 company, 1 demo user, 10 candidates, 4 jobs.

### Feature: React dashboard
#### Validation
- `vite build` succeeds (type/JSX safe); dev server + API proxy verified end-to-end (login over proxy).

---

## Current Work

### Active Feature
— (all features complete)

### Progress
N/A

### Remaining Work
N/A

---

## Next Actions

1. (Optional) Add resume file upload / drag-drop that parses text from PDF/DOCX into `resume_text`.
2. (Optional) Add candidate "archived" state toggle in UI (backend filter already honors it).
3. (Optional) Production hardening: set real `JWT_SECRET`, add rate limiting, run behind HTTPS.

---

## Risks

### Open Questions
- None blocking.

### Known Issues
- Experience-fit matching uses word-overlap heuristics on requirement phrases; scores are best-effort and shown transparently in the UI breakdown. (Low severity, by design.)

### Technical Concerns
- Node 24.19.x + better-sqlite3 ≤ 12.x crashes with `RemoveEnvironmentCleanupHook` assertion (GC-finalization race). **Mitigation applied:** pinned `better-sqlite3@^13.0.3` (N-API rewrite), which eliminates the crash path. Do not downgrade.
- WAL mode enabled; three `-wal`/`-shm` files accompany the DB file — normal.

---

## Troubleshooting Log

### Problem: `Assertion failed: (env) != nullptr` in `node::RemoveEnvironmentCleanupHook` from `Statement::~Statement()` during `npm run seed`
- **Attempts tried:**
  1. Re-running seed (symptom persisted).
  2. Upgraded `better-sqlite3` from 11.10.0 → 13.0.3.
- **Sources checked (web/docs):** web search for "better-sqlite3 RemoveEnvironmentCleanupHook assertion Node 24" — confirmed upstream regression nodejs/node#63642 backported into Node 24.19.x; better-sqlite3 13.x (N-API) fixes by construction.
- **Current hypothesis:** Node ObjectWrap cleanup-hook teardown race during GC on Node 24.19.
- **Status:** resolved (upgrade to better-sqlite3 13.x).

---

## Resume Instructions

- **Verify current state:** `cd ~/git/talentflow/server && npm test` (expect 9 passing), then `npm run db:seed`.
- **Run the app:** from repo root: `npm run dev` → open http://localhost:5173, log in `demo@acmetalent.com` / `password`.
- **Where to start reading:** `server/src/matching.js` (scoring core, pure functions), `server/src/index.js` (all routes), `client/src/Matches.jsx` (ranked candidates UI).
- **Next concrete step:** none required; optional enhancements listed in Next Actions.