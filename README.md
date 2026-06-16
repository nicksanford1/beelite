# Beelite

Commercial flooring **takeoff & estimating** app (Next.js + Supabase + Prisma).
Upload plans → AI reads the finish schedule → do a traceable room-level takeoff →
sync into a Google Sheet the estimator already trusts.

Single project, app lives at the repo root.

## Docs
- [`docs/v1-plan.md`](docs/v1-plan.md) — what we're building and why (product spec)
- [`docs/architecture.md`](docs/architecture.md) — how it's wired: stack, schema, Sheets contract, prompts

## Setup (keys, by feature)
Copy `.env.example` → `.env` and fill in as each feature comes online:

| Feature | Needs |
|---|---|
| Database + file storage | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| AI finish-schedule reading | `ANTHROPIC_API_KEY` |
| Google Sheets sync | `GOOGLE_SERVICE_ACCOUNT_JSON` |

## Run
```bash
npm install
npm run db:push      # apply the Prisma schema
npm run dev          # http://localhost:3000
```
