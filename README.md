# aresearch

Next.js + TypeScript + Tailwind v4. OpenAI embeddings stored in SQLite via `sqlite-vec`.

## Setup

```bash
npm install
cp .env.example .env.local   # set OPENAI_API_KEY
npm run dev
```

## Index documents

```bash
curl -X POST http://localhost:3000/api/index \
  -H "content-type: application/json" \
  -d '{"texts":["first doc","second doc"]}'
```

## Search

Use the UI at `/`, or:

```bash
curl -X POST http://localhost:3000/api/search \
  -H "content-type: application/json" \
  -d '{"query":"something","k":5}'
```

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS v4 (`@import "tailwindcss"`, `@tailwindcss/postcss`)
- `openai` — `text-embedding-3-small` (1536 dims)
- `better-sqlite3` + `sqlite-vec` (`vec0` virtual table)
