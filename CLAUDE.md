# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, Lint

```bash
pnpm lint                # ESLint 9 (flat config)
pnpm test                # Vitest — all tests once
pnpm test:watch          # Watch mode
pnpm build               # Next.js production build
pnpm dev                 # Dev server

# Single test file
pnpm vitest run lib/__tests__/chunker.test.ts

# Match test name pattern
pnpm vitest run -t "treats rewrite-style"

# Database
pnpm db:push             # Push schema to local Postgres
pnpm db:generate         # Generate Drizzle migrations
pnpm db:migrate          # Apply migrations from drizzle/
pnpm db:studio           # Drizzle Studio GUI
```

Tests use Vitest with jsdom environment, `@/` path alias, and globals enabled. Setup in `vitest.setup.ts`. Test files live in `lib/__tests__/`.

## Architecture

**Kite** is a multi-tenant API documentation platform. Users manage workspaces containing OpenAPI specs, rich-text documents, and AI-powered tooling.

### Stack

- **Next.js 16** (App Router, standalone output) + **React 19** + **TypeScript** (strict)
- **Drizzle ORM** + **PostgreSQL** (pgvector for embeddings, tsvector for full-text search)
- **NextAuth v5** (JWT strategy, GitHub + Google OAuth, dev mock auth via `DEV_MOCK_AUTH_ENABLED`)
- **Tailwind CSS v4** (OKLCH color tokens) + **shadcn/ui** (New York style, RSC enabled)
- **AI SDK** (`ai` package v6) with OpenAI, Anthropic, and Google providers
- **pnpm workspaces** monorepo: root app + `packages/cli`

### Key directories

- `app/api/` — REST API routes (37 route groups), all guarded by `withWorkspaceAuth()`
- `app/docs/` — Main editor interface
- `app/pub/[slug]` — Public documentation reader
- `lib/queries/` — Query modules, each exporting async functions scoped to `workspaceId`
- `lib/schema-*.ts` — Modular Drizzle schema files, barrel-exported from `lib/schema.ts`
- `lib/openapi/` — OpenAPI parsing, validation, diff, mock server, SDK generation
- `lib/search/` — Full-text search (tsvector) + semantic search (pgvector cosine similarity)
- `lib/ai-chat.ts` — Main AI chat interface (streaming, context assembly, tool calling)
- `lib/ai-config.ts` — Centralized RAG configuration, all overridable via `AI_*` env vars
- `components/ui/` — shadcn/ui primitives; `components/docs/`, `components/settings/`, etc. for features
- `packages/cli/` — `@kite/cli` tool

### Multi-tenancy

Every data query is scoped to a `workspaceId`. The `withWorkspaceAuth(role)` function in `lib/api-utils.ts` is the single entry point for auth + role enforcement in all API routes. Role hierarchy: `guest < member < admin < owner`.

### RAG / AI pipeline

Documents are chunked (500 tokens, configurable), embedded (`text-embedding-3-small`), and stored in pgvector. Chat queries flow: vector search → context assembly → optional reranking → LLM streaming. All RAG constants live in `lib/ai-config.ts` and are overridable via `AI_*` env vars.

## Conventions

### API route pattern

Every API route follows this structure:

```typescript
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error
  const { ctx } = result // { userId, workspaceId, workspaceName, role }

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  // Manual validation — no Zod. Use type guards and constants from lib/constants.ts
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('Name is required')

  const data = await createThing(ctx.workspaceId, { name })
  return NextResponse.json(data, { status: 201 })
}
```

Error helpers: `unauthorized()` (401), `forbidden()` (403), `notFound()` (404), `badRequest(msg)` (400). Error logging uses fire-and-forget `captureError()` from `lib/error-collector.ts` and `logServerError()` from `lib/server-errors.ts`.

### Database queries

All in `lib/queries/*.ts`. Always scope to `workspaceId`. Use Drizzle's `eq()`, `and()`, `sql` operators. Soft deletes via `deletedAt` column. Single shared `db` instance from `lib/db.ts` (postgres.js driver, pool of 10).

### Schema changes

Add new tables in a dedicated `lib/schema-{domain}.ts` file, then re-export from `lib/schema.ts`. Run `pnpm db:push` to apply locally, `pnpm db:generate` to create migration files.

### Components

- Default = Server Component. Add `'use client'` only for interactive state/hooks.
- Server actions use inline `'use server'` inside form elements, not separate files.
- Feature-grouped folders (`components/docs/`, `components/settings/`, etc.) with kebab-case file names.
- Icons: Lucide React. Theme: next-themes with `class` attribute strategy.

### Imports

Always use the `@/` path alias:

```typescript
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
```

## Design Direction

Brand: Neutral · Professional · Accurate. Visual references: Stripe Docs, Notion, Vercel Docs.

- OKLCH color space: warm neutrals (hue 85–95°) for surfaces, cool blue (hue 244°) for interactive states
- Both light and dark mode fully supported
- Geist (sans) + Geist Mono fonts; base radius 0.375rem
- Content density over decoration — no heavy shadows, saturated fills, or decorative chrome
- WCAG AA compliance required
