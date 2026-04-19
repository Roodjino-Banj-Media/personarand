# Personal Brand Command Center

Content calendar, AI-assisted generation, and performance tracking for the Roodjino personal brand.

## Setup

```bash
npm run install:all            # installs root, server, client
cp .env.example .env           # then edit .env to add ANTHROPIC_API_KEY
npm run db:init                # create SQLite DB + seed 30-day calendar
npm run dev                    # starts server on :3001 and client on :3000
```

Open http://localhost:3000

## Structure

- `server/` — Express API on :3001, SQLite via better-sqlite3
- `client/` — React + Vite + Tailwind on :3000, proxies /api to server
- `uploads/` — visual inspiration files (Phase 2)

## Scripts

- `npm run dev` — concurrent server + client
- `npm run db:init` — initialize and seed the database
- `npm run db:reset` — drop and recreate (destroys all data)
