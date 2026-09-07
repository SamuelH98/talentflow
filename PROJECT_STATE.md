# PROJECT_STATE

## Project Overview

### Project Name
TalentFlow — local hiring & candidate-ranking app

### Goal
A locally hosted "Workday-lite" where companies add jobs and candidates, and the app automatically scores/ranks the best candidates per job with transparent match breakdowns.

### Current Status
Recruiter UI + public candidate portal shipped. EEO questions + local resume parsing, recruiter-managed screening questions (library + per-job config), recruiter-only dark mode (OS default + toggle + company brand in topbar), publishability packing (AGPL, Docker, prod serving — committed `0d00bfc`), candidate privacy/consent + audit log (Milestone B), **company brand theming** (admin-set brand + nav/accent colors + live preview, driving the entire recruiter app + candidate portal, persisted per-company), **company logo** (admin upload in org settings, shown across topbar/login/portal), and a **global topbar search** (live dropdown across candidates/jobs/applications) all implemented with **25 passing server tests**; client builds cleanly.

Milestone B (candidate privacy + consent) is implemented and documented: applications require consent (stored `consented_at` + `policy_version`), the portal offers "Manage my data" (portable JSON export + token-gated full erasure incl. the resume file), the recruiter UI has an Activity log (company-scoped audit trail with sign-ins, candidate/job changes, stage changes, self-service erasures), and end-to-end smoke tests verified apply → export → erasure → audit over HTTP. Remaining: client build + the Milestone B commit.

---

## Completed Features

### Feature: Screening questions (recruiter library + per-job config)
#### Validation
- API test suite covers: library CRUD/validation/company isolation; per-job "inherit defaults → materialize → public reflects"; apply-time validation (422 with missing labels), answer sanitization (unknown options/questions dropped, multiple→array), labelled recruiter-only visibility incl. fallback label for deleted questions.
- Live smoke test against a running server: 3 seeded questions in library, `GET /api/jobs/:id/screening` returns inherited config with per-question flags, and `GET /api/applications` returns labelled screening answers for Sara Chen + Aisha Khan.
#### Tests Added
- `server/tests/screening.test.js` — 3 subtests; `server/tests/portal-apply.test.js` updated for nested `{eeo, screening}` answers. Total suite: 22 passing.

### Feature: Candidate privacy, consent & audit log (Milestone B)
#### Validation
- **Consent gate:** `POST /api/public/applications` rejects applications without `consent` (422); approved ones store `consented_at` + `policy_version` (legacy rows backfilled on migration). Verified via `tests/privacy.test.js` and live producer (no-consent → 422; with consent → matched).
- **Decoupled resume storage fix:** `db.js` gained `resolveUploadsDir()` (env resolved at request time) — root cause of a flaky test where `node --test` shares module state and ignored a late-set `UPLOADS_DIR`; writes now go to the configured dir and erasure deletes the file from disk.
- **DSAR export:** `GET/POST /api/public/export` returns candidate + applications + answers + consent records + resume filename + `erasure_token` (an application `tracking_token`) + `erasure_note`; unknown emails → 404.
- **Right-to-erasure:** `POST /api/public/erasure` requires `email` + `erasure_token` matching one of the candidate's application tokens (else 403), then deletes application_answers (cascade), applications, candidate, and the stored resume file; logs `candidate.erasure`. Verified live: export 200 → erasure bad token 403 → erasure good token 200 → export after = 404, uploads dir empty.
- **Audit log:** `GET /api/audit?limit=` (recruiter, company-scoped, default 50 max 200). Logs `auth.login`, `candidate.*`, `job.*`, `application.create` (incl. public portal applies, attributed to the candidate email), `application.status`, and `candidate.erasure`. Live smoke verified the full trail: login → apply → stage change → (erase).
#### Tests Added
- `server/tests/privacy.test.js` — consent required/apply, multipart apply with real file, export (404 + full data), erasure token gate, erasure row+file deletion, audit rows + `GET /api/audit`. `portal-apply.test.js`/`public.test.js`/`screening.test.js` updated for `consent`. Total suite: 23 passing.

### Feature: Dark mode + company brand (recruiter UI)
#### Validation
- Client builds cleanly; theme via `useTheme()` (`talentflow_theme` in localStorage, OS `prefers-color-scheme` default) driving `[data-theme="dark"]` token overrides. Public portal is wrapped in `data-theme="light"` so it stays light regardless of the recruiter preference.
- Topbar now leads with the recruiting company's avatar/name; TalentFlow is the smaller secondary line.
#### Tests Added
- None (CSS/UI); backend unchanged and covered.

### Feature: Company brand theming (admin-set brand color)
#### Validation
- `companies` gained `brand_color` (PRAGMA-checked migration in `db.js`); `GET /api/public/company` and `GET /api/me` expose it, `PUT /api/company/brand` (admin-only, `#rrggbb` validated) persists + audits it.
- Client theme rebuilt on the fly from the brand color: `buildTheme({ kind, brand })` derives the MUI primary ramp (`main`/`dark`/`light` + contrast, light + dark schemes), and helpers `brandGradient`/`displayOnBrand` color the login hero, the recruiter logo box, and the portal brand mark. Fallback default is indigo (`#4f46e5`) via `DEFAULT_BRAND`/`normalizeHex` for invalid/missing values.
- Admin topbar button opens a swatch dialog (presets + native hex input + "Reset to default"); saved via `api.setCompanyBrand`, updates `user.company` in app state so both the recruiter app and portal re-theme live. Non-admins don't see the button; the endpoint returns 403 for recruiters.
- **Org settings modal:** the color picker moved into an **Organization settings** dialog (topbar gear) that also edits the company name — persisted via `PUT /api/company/settings` (admin-only, name + brand_color validated, audited as `company.update`). Recruiters still see the gear but get an "ask your org admin" dialog instead; the settings endpoint returns 403 for them. Login screen also shows the company mark + name ("Powered by TalentFlow") and brand gradient from `GET /api/public/company`.
- **Dashboard color customization:** three editable colors — **brand** (primary accent app-wide), **navigation** (`nav_color`, left sidebar background + auto-contrast text), and **accent** (`accent_color`, KPI/status highlights via the `accent2` theme token). Stored per-company (`companies.nav_color`/`accent_color`, PRAGMA migrations), exposed via `/api/me` + `/api/public/company`. **Live preview:** picking a color re-skins the app behind the modal instantly (`themePreview` override feeds `buildTheme`); Save persists, Cancel/ESC reverts to the stored colors.
- **Company logo:** admin can upload/replace/remove the logo in the same settings modal (`PUT/DELETE /api/company/logo`, multipart `logo`, png/jpg/jpeg/gif/webp/svg/avif ≤ 5 MB; old file deleted on replace/remove). `GET /api/company/logo` serves it publicly and `GET /api/public/company` exposes `logo_path`; the shared `CompanyMark` component renders the image everywhere (topbar, login hero, portal head, settings preview) and falls back to a brand-gradient initial when no logo / invalid image.
- **Global search:** a centered topbar search opens a live dropdown (debounced `GET /api/search?q=` across candidates/jobs/applications), de-duped/grouped results navigate to the section with the filter applied; empty-state "jump to" quick links and Enter-to-open Candidates. Neutrally-gray styling (no brand tint) and a rounded dropdown matching app cards.
#### Tests Added
- `server/tests/api.test.js` — brand test covers 401 unauthenticated, 403 recruiter, 400 bad hex, admin update persists, reflected in `/api/public/company` + `/api/me`; settings test covers 403 recruiter, 400 blank name, admin name+brand+nav+accent update, 400 bad nav hex, public reflection; logo test covers 403 non-admin upload, admin upload round-trip (`logo_path` set + served via `GET /api/company/logo`), delete (null + 404); global-search test covers candidate/job match, candidate-by-name, application-by-candidate-name, no-match empties, 401 unauth. `public.test.js` public-company shape now includes `brand_color`, `logo_path`, `nav_color`, `accent_color`. Total suite: 25 passing.

---

## Previous milestones

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
Milestone B (candidate privacy & consent) is implemented server + client and documented. Remaining: client build (already passing) + full test suite, then the milestone commit.

### Progress
- **Schema:** `applications` gained `consented_at` + `policy_version` (PRAGMA-checked migration, legacy backfill); new `audit_log` table + indexes.
- **Server:** `privacy.js` (policy constants + notice), `logAudit()` in `auth.js`, JWT now carries `email`; consent gate, `GET /api/public/privacy`, DSAR export/erasure, `GET /api/audit`; `logAudit` wired into portal applies (attributed to the candidate email) and every recruiter mutation route.
- **Client:** portal `ApplyModal` consent checkbox (fetch + display `api.publicPrivacy()`); new "Manage my data" module (`api.publicExport`/`api.publicErasure`) reachable from track views; recruiter **Activity log** view (`Audit.jsx`) + NAV entry using `api.auditLog()`.
- **Erasure token design:** DSAR export returns one of the candidate's application `tracking_token`s as proof-of-ownership; a separate random token was tried and reverted after the exported token never matched an application.

### Remaining Work (Milestone B)
1. Client build (`npm run build`) + full suite (`npm test` → 24) — already green.
2. Commit Milestone B ("Candidate privacy: consent, export/erasure flow, and audit log").

---

## Next Actions

1. **Commit brand theming** — verify `npm test` (24) + client build, commit the company-brand-color work.

---

## Next Actions

1. **Commit Milestone B** — verify `npm test` (24) + client build, commit the privacy/consent/audit work. (Brand theming commits next.)
2. (Optional) Public portal hardening when exposed publicly: cap lookup rate, add basic bot protection on `POST /api/public/applications`.
3. (Optional) Add candidate "archived" state toggle in UI (backend filter already honors it).

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

- **Verify current state:** `cd ~/git/talentflow/server && npm test` (expect 24 passing), then `cd ~/git/talentflow/client && npm run build`.
- **Run the app:** from repo root: `npm run dev` → open http://localhost:5173, log in `demo@acmetalent.com` / `password`; portal at http://localhost:5173/#/portal (status pages live at `#/portal/status/<token>`). Production mode: `cd server && npm run start:prod` → http://localhost:4000 (single origin).
- **Where to start reading:** `server/src/matching.js` (scoring core, pure functions), `server/src/index.js` (all routes incl. `/api/public/*` + `/api/screening/*` + prod static serving), `server/src/screening.js` (library, per-job config, answer sanitizing), `server/src/seed.js` (`seed()` export used for `SEED_ON_BOOT`), `server/src/resume.js` (resume extraction + auto-fill heuristics), `server/src/questionnaire.js` (EEO questions), `client/src/App.jsx` (routing + theme), `client/src/theme.js` (dark-mode hook), `client/src/CandidatePortal.jsx` (portal UI + ApplyModal), `client/src/Screening.jsx` (library UI).
- **Next concrete step:** commit Milestone B (candidate privacy: consent, export/erasure flow, audit log) — see Next Actions.