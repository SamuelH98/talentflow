# PROJECT_STATE

## Project Overview

### Project Name
TalentFlow — local hiring & candidate-ranking app

### Goal
A locally hosted "Workday-lite" where companies add jobs and candidates, and the app automatically scores/ranks the best candidates per job with transparent match breakdowns.

### Current Status
Recruiter UI redesigned + public candidate portal shipped. Workday-style EEO questions + local resume parsing (upload → auto-fill) implemented with 18 passing server tests; client builds cleanly. All work is uncommitted (working tree) — next commit is a milestone.

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

### Feature: Recruiter UI redesign (light enterprise polish)
#### Validation
- Client builds cleanly; every class name used by the 4 recruiter views + new components is defined in the rewritten `styles.css` design system.
#### Tests Added
- None (CSS/UI); backend behavior unchanged and fully covered by API tests.

### Feature: Public candidate portal
#### Validation
- Portal API covered end-to-end by `server/tests/public.test.js` (browse, one-click apply, duplicate-apply token reuse, tokenized status, email lookup, no score/company leakage).
- Client implements `#/portal` (browse + apply + track-by-email) and `#/portal/status/:token` (deep-linkable, shareable tracking page).
#### Tests Added
- `server/tests/public.test.js` — 1 integration test, multiple assertions.

### Feature: Tracking pipeline seed
#### Validation
- `npm run db:seed` now creates 8 applications across all stages (hired 1, interview 3, in_review 3, matched 1) with unique `tracking_token`s so the portal has live-looking data on first run.

### Feature: Workday-style EEO questions + resume parsing (portal apply)
#### Validation
- Questionnaire served via `GET /api/public/questionnaire` (5 questions, Workday/OFCCP wording: current employee, gender identity, race/ethnicity, veteran status, disability — each with per-question disclosure + privacy banner).
- Resume parse endpoint `POST /api/public/resume/parse` extracts text from `.pdf`/`.docx`/`.txt` and auto-fills name/email/phone/location/years/skills/summary; unsupported types (415) and unreadable files (422) handled.
- Apply is now multipart: stores the resume file on disk + `resume_text` on the candidate, persists sanitized EEO answers to a separate `application_answers` table; recruiter and portal routes never read EEO data (no `answers` key anywhere).
- Live smoke test against a running server verified questionnaire, parse, and auto-fill; regression added so `java` is not falsely detected from `JavaScript` (word-boundary match).
#### Tests Added
- `server/tests/resume.test.js` (7), `server/tests/portal-apply.test.js` (2). Total suite: 18 passing.

---

## Current Work

### Active Feature
Workday-style EEO questions + resume parsing (portal) — implemented, awaiting commit.

### Progress
- Server: `questionnaire.js`, `resume.js` (extraction + heuristics + aliases), `application_answers` table, resume columns on `candidates`, multipart apply + resume download + multer error handling.
- Client: `ApplyModal` rewrite in `CandidatePortal.jsx` (resume drop zone → auto-fill, radio-card EEO grid with detail fields + disclosures, 409 duplicate → jump to tracker); `api.js` FormData-aware + `publicQuestionnaire`/`resumeParse`; `Icons.jsx` `upload`/`lock`; new CSS (`resume-drop`, `radio-grid`/`radio-card`, `eeo-*`, `detail-input`, `disclosure`).
- Docs: README updated (features, routes, layout, portal blurb).

### Remaining Work
1. Commit frontend/backend milestone (server changes already committed in `432a561`; client + docs + resume-fix pending commit).
2. (Optional) "View resume" button on the recruiter Candidates view via `GET /api/candidates/:id/resume`.

---

## Next Actions

1. **Commit milestone** — client (ApplyModal, api.js, Icons, styles, CandidatePortal wiring), the `java`-matcher fix + regression test, and README/PROJECT_STATE updates as "Candidate portal: EEO questions + resume upload/auto-fill".
2. (Optional) Add candidate "archived" state toggle in UI (backend filter already honors it).
3. (Optional) Production hardening: set real `JWT_SECRET`, add rate limiting, run behind HTTPS.
4. (Optional) Public portal hardening when exposed publicly: cap lookup rate, add basic bot protection on `POST /api/public/applications`.

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

- **Verify current state:** `cd ~/git/talentflow/server && npm test` (expect 18 passing), then `cd ~/git/talentflow/client && npm run build`.
- **Run the app:** from repo root: `npm run dev` → open http://localhost:5173, log in `demo@acmetalent.com` / `password`; portal at http://localhost:5173/#/portal (status pages live at `#/portal/status/<token>`).
- **Where to start reading:** `server/src/matching.js` (scoring core, pure functions), `server/src/index.js` (all routes incl. `/api/public/*`), `server/src/resume.js` (resume extraction + auto-fill heuristics), `server/src/questionnaire.js` (EEO questions), `client/src/App.jsx` (routing), `client/src/CandidatePortal.jsx` (portal UI + ApplyModal).
- **Next concrete step:** commit the EEO + resume milestone (see Next Actions).