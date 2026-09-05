# TalentFlow — ATS Feature Matrix

TalentFlow is a local-first, single-file hiring tool. This matrix compares what
it ships today against the feature set a modern ATS is expected to cover (the
2026 buyer's-checklist framing used by Treegarden and the Greenhouse-vs-Lever-
vs-Ashby comparisons).

Legend: ✅ shipped · 🔨 in progress · 🛣️ on the roadmap · ⛔ deliberately out of scope

| Capability | Typical ATS | TalentFlow | Notes |
| ---------- | ----------- | ---------- | ----- |
| **Job / requisition management** | required | ✅ | Jobs, departments, salary band, requirements, open/closed |
| **Candidate database** (search, source, talent pool) | required | ✅ (partial) | Full CRUD + resume text stored; search/dedupe are roadmap |
| **Pipeline / kanban** | required | 🔨 | Statuses exist (matched → review → interview → hired); visual kanban is next |
| **Automatic resume parsing** | required | ✅ | `.pdf` / `.docx` / `.txt`, 5 MB cap, auto-fills contact + skills + summary (local, no cloud) |
| **EEO / self-identification** (Workday-style) | required | ✅ | OFCCP-style questions, disclosure per question, stored but never shown in pipeline views |
| **Candidate consent + privacy** | required | ✅ | Consent stored with timestamp + policy version on every application |
| **Right-to-erasure (DSAR) management** | required | 🔨 | Portal "Manage my data" → export + erasure flow are in progress |
| **Audit log** (who did what, when) | required | 🔨 | Planning a lightweight recruiter action log |
| **Role-based access + multiple users** | expected | 🛣️ | Single recruiter role today; multi-user + roles are roadmap |
| **Candidate communications / templates** | expected | 🛣️ | Not yet |
| **Interview scheduling + scorecards** | expected | 🛣️ | Not yet |
| **Analytics** (time-to-fill, funnel, source, offer-accept) | expected | 🛣️ | Data model supports it; dashboards planned |
| **Explainable AI scoring, human-in-the-loop** | 2026 differentiator | ✅ | Transparent skill/experience/years breakdown on every match; no hidden black box |
| **Talent-pool rediscovery** (re-rank past applicants) | 2026 differentiator | ✅ | `GET /api/jobs/:id/matches` re-scores the whole pool against any job |
| **Automated indifference / candidate follow-up** | nice-to-have | 🛣️ | Roadmap only |
| **Multi-language / i18n** | nice-to-have | 🛣️ | Roadmap only |
| **Cloud sync** | — | ⛔ | By design — talent data stays on your machine |
| **External AI API dependency** | — | ⛔ | Scoring is fully local and offline-capable |

## How TalentFlow positions vs. open-source peers

| | OpenCATS | Reqcore | Vellum | **TalentFlow** |
| -- | -------- | ------- | ------ | ------- |
| Stack | PHP (dated) | Nuxt + Postgres | Next.js + Prisma + Postgres | Node + Express + **SQLite** |
| Deploy cost | heavy | requires Postgres | requires Postgres | **zero-config: `npm run dev`, one file DB** |
| Candidate portal out of the box | weak | partial | partial | ✅ built-in shareable careers page + status tracking |
| License | AGPL | AGPL | AGPL | AGPL (this repo) |
| Local-first / offline | — | — | — | ✅ no external services at all |

The differentiator: TalentFlow runs in under a minute with no database server
and no cloud account, yet covers the attestation-heavy candidate journey
(EEO, consent, resume parsing, transparent scoring) that modern buyers expect.

## Source of the checklist framing

- Treegarden ATS Buyer's Guide (2026) — 12-capability checklist
- EasyHire — "Greenhouse vs Lever vs Ashby" comparison (2026)
- Reqcore / Vellum / OpenCATS public READMEs (AGPL positioning)