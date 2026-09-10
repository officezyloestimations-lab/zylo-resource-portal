# Zylo Resource Portal

Internal tool for Zylo Estimation: a single, searchable catalog of every bid
portal (plan-holder / bidders lists tied to open bids) and directory
(contractor/sub rosters, licensing boards, trade associations — not tied to
a specific bid) that the team has found, organized by state, with a
verification workflow so stale or login-gated sources don't quietly rot.

Access is invite-only — there is no public sign-up anywhere in this app.

## Stack

- **Next.js 14** (App Router, TypeScript) — single deployable app, frontend + backend
- **PostgreSQL** via [Neon](https://neon.tech) (free tier) — or any Postgres, via `DATABASE_URL`
- **Prisma** — schema, migrations, type-safe queries
- **NextAuth.js** (Credentials provider) — invite-only email/password auth, JWT sessions
- **Tailwind CSS** — styling
- **Vercel** — hosting, auto-deploys from this repo's `main` branch

## Features

- Dashboard with counts by state, type (bid portal vs. directory), and verification status
- Browse/search/filter by state, type, trade, verification status, requires-login, free text
- Add / edit / archive sources through a form (no bulk upload in the UI by design — see below)
- Verification queue: everything flagged `NEEDS_VERIFICATION` or `UNVERIFIED`, grouped by state, with a one-click "mark verified" that stamps who verified it and when
- Full audit log per source (who created/edited/verified/archived it, and when)
- Export the current filtered view to `.xlsx` for feeding into the existing outreach pipeline
- A one-time bulk **import script** (run from the command line, not the UI — see below) that ingests Zylo's existing Excel/CSV/txt source workbooks, classifies each row as a bid portal or directory, detects state, and dedupes against what's already in the database

## Getting started (local development)

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
npm run db:migrate         # creates the schema in your Postgres database
npm run db:seed            # creates the two founder accounts from SEED_ADMIN_* env vars
npm run dev
```

Visit `http://localhost:3000`, sign in with whichever `SEED_ADMIN_*_EMAIL` /
`SEED_ADMIN_*_PASSWORD` you set, and you're in.

## Deploying (Vercel + Neon)

1. Create a free [Neon](https://neon.tech) Postgres project, copy its connection string.
2. Push this repo to GitHub (private repo recommended — see below).
3. Import the repo into [Vercel](https://vercel.com/new).
4. In Vercel's Project Settings → Environment Variables, set:
   - `DATABASE_URL` — the Neon connection string
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your Vercel deployment URL (e.g. `https://zylo-resource-portal.vercel.app`)
   - `SEED_ADMIN_1_EMAIL` / `SEED_ADMIN_1_PASSWORD` / `SEED_ADMIN_2_EMAIL` / `SEED_ADMIN_2_PASSWORD` — set these **once**, run the seed step below, then delete them from Vercel's env vars (they're not needed at runtime, only at seed time).
5. Run the migration and seed against production once, from your machine, pointed at the Neon `DATABASE_URL`:
   ```bash
   DATABASE_URL="<neon-connection-string>" npm run db:deploy
   DATABASE_URL="<neon-connection-string>" SEED_ADMIN_1_EMAIL=... SEED_ADMIN_1_PASSWORD=... SEED_ADMIN_2_EMAIL=... SEED_ADMIN_2_PASSWORD=... npm run db:seed
   ```
6. Deploy. Every push to `main` auto-deploys from then on.

## Adding new sources going forward

By design, there's no in-app bulk upload — new sources are added one at a
time through **Add Source**, so each one gets a deliberate look before it's
in the catalog. The one-time bulk importer below is only for loading the
backlog of sources already cataloged in Zylo's existing Excel/txt workbooks.

## Bulk-importing existing source workbooks

```bash
mkdir -p data/incoming
# copy your Excel/CSV/txt source files into data/incoming/
npm run import:sources -- --dry-run   # see what it would do first
npm run import:sources                # actually import
```

See `scripts/import-sources.ts` for exactly how it classifies bid portal vs.
directory and detects state — it's a heuristic first pass, so plan to spend
a little time in the Verification Queue afterward reclassifying or removing
a handful of rows it got wrong. Files in `data/incoming/` are git-ignored;
they never get committed.

## Security notes

- **No public sign-up.** The only way to create an account is the seed
  script, run from a trusted machine against the production database. There
  is no `/signup` or `/register` route in the app at all.
- **Every route requires a session** except `/login` and NextAuth's own
  `/api/auth/*` endpoints (enforced in `src/middleware.ts`).
- Passwords are hashed with bcrypt (cost factor 12); the app never
  stores or displays a plaintext password anywhere, including in the
  seed script's own database writes.
- Sessions are signed JWTs (`NEXTAUTH_SECRET`); rotate that secret if it's
  ever exposed, which will invalidate all active sessions.
- **Don't put real login credentials for a bid portal/directory in the
  Notes field.** Notes are plain text in the database — fine for hints like
  "ask Rehan for the Bonfire login" but not for an actual password. If Zylo
  wants to store real credentials for gated portals later, that needs a
  dedicated encrypted-secret field, not the free-text notes column — ask
  for that as a follow-up if it comes up.
- Keep the GitHub repo **private** — it will end up containing internal
  business context (source notes, audit history of who edited what).
- Dependency security: this app pins `next@14.2.35`, the latest patch on the
  14.2 line, which fixes the Next.js middleware authorization-bypass
  advisory (GHSA-f82v-jwr5-mffw) that's directly relevant to this app's
  route protection. A `npm audit` will still show a handful of Next.js
  advisories that require jumping to Next 16 (a breaking-change upgrade,
  not done here to avoid destabilizing a fresh app) — the ones remaining
  mostly involve features this app doesn't use (custom servers, Edge
  runtime Server Actions, AVIF image optimization, Windows-hosted
  deployments). Re-run `npm audit` periodically and plan a Next 15/16
  upgrade later; consider turning on GitHub's Dependabot alerts on the repo.
  The `xlsx` package (used for `.xlsx` export/import) has two known issues
  with no upstream fix as of this build; exposure here is low since it only
  parses files Zylo supplies itself (the import script), never files
  uploaded by an anonymous visitor.

## Data model

See `prisma/schema.prisma`. Summary:

- **Source** — one bid portal or directory: name, URL, type, state, trades
  covered, requires-login flag, verification status, notes, tags, soft-delete
  status (`ACTIVE` / `DEAD_LINK` / `ARCHIVED`).
- **User** — the two invite-only founder accounts.
- **AuditLog** — append-only log of create/update/verify/archive actions,
  tied to the user who did it.

## Project structure

```
prisma/schema.prisma       Data model
prisma/seed.ts              Creates the two founder accounts
scripts/import-sources.ts   One-time bulk importer for existing workbooks
src/app/                    Pages (dashboard, sources, login) — Next.js App Router
src/lib/actions.ts           Server actions: create/update/archive/verify a source
src/lib/auth.ts              NextAuth config (Credentials provider)
src/middleware.ts            Route protection
src/components/              Shared UI (Navbar, SourceForm, ExportButton)
```
