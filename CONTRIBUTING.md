# Contributing to TalentFlow

Thanks for wanting to help make TalentFlow better. This is a small, friendly,
single-purpose project, and every contribution counts — code, docs, issues, and
design feedback.

## Project overview

- **Stack:** Node.js (ESM) + Express + better-sqlite3 backend, React + Vite
  frontend. Node 20 or newer.
- **Storage:** a single SQLite file in `server/data/` and uploaded resumes in
  `server/data/uploads/` — no database server to install.
- **License:** AGPL-3.0 (see [LICENSE](LICENSE)). By contributing you agree
  that your contributions are licensed under the same terms.

## Getting started

```bash
git clone <your-fork-url> talentflow
cd talentflow
npm run setup       # installs server + client dependencies
npm run db:seed     # creates a demo company, jobs, candidates, and a login
npm run dev         # runs API (:4000) + client dev server (:5173)
```

Demo login: `demo@acmetalent.com` / `password`.

## Common commands

| Command               | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | API (:4000) + Vite dev server (:5173)               |
| `npm run server`      | API only (:4000)                                    |
| `npm run client`      | Vite dev server (:5173) only                        |
| `npm run test`        | Run the server test suite (`node --test`)           |
| `npm run db:seed`     | Seed/reset demo data (idempotent)                   |
| `cd server && npm run build` | Build the client into `client/dist`          |
| `npm run build`       | Build client                                        |
| `cd server && npm run start:prod` | Build client + serve everything from Express |

## Development workflow

1. **Branch before you break things.** Work on a feature branch
   (`git checkout -b feat/your-thing`), not `main`.
2. **Make focused commits.** Small, single-purpose commits are easier to
   review and bisect. Use the conventional style:
   `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
3. **Keep tests green.** Anything touching server behavior needs a test in
   `server/tests/`. Run the full suite with `npm run test` before pushing.
4. **Check the build.** For frontend changes run `cd client && npm run build`
   so TypeScript/Vite errors surface before review.
5. **Open a pull request.** Describe what changed and why, and mention any
   manual verification you did (e.g. `curl` checks against `:4000`).

## Code style notes

- Server is plain ESM (`import`/`export`, `type: "module"`), no build step.
- SQL goes through prepared statements via `better-sqlite3` — no string
  interpolation of user input.
- The client uses React functional components with hooks; existing component
  patterns in `client/src/` are the reference.
- Don't add comments unless they explain a non-obvious decision.

## Privacy is a feature

TalentFlow stores real people's data. When changing candidate-facing or
recruiter-facing flows:

- Never expose candidate PII on public (unauthenticated) endpoints.
- Keep EEO / screening answer handling server-side and scoped to the
  application they belong to.
- Preserve the consent marker on applications (see the portal apply flow).

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, and the
repro steps. Include output from `npm run test` if relevant.

## Need help?

Ask in the GitHub discussion tab or open an issue — there are no silly
questions and no maintainers to ping.