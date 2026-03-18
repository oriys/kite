# Copilot Instructions — Kite

## Build, Test, Lint

```bash
pnpm lint          # ESLint (flat config, eslint 9)
pnpm test          # Vitest — all tests
pnpm build         # Next.js production build

# Run a single test file
pnpm vitest run lib/__tests__/ai-actions.test.ts

# Run tests matching a name pattern
pnpm vitest run -t "treats rewrite-style"

# Watch mode
pnpm test:watch

# Database
pnpm db:push       # Push schema to local Postgres (reads .env)
pnpm db:generate   # Generate Drizzle migrations
pnpm db:migrate    # Apply migrations
pnpm db:studio     # Open Drizzle Studio GUI
```

Tests use Vitest with jsdom environment, `@` path alias, and globals enabled. Setup is in `vitest.setup.ts`.

## Architecture

**Kite** is a multi-tenant API documentation platform. Users manage workspaces containing OpenAPI specs, rich-text documents, and AI-powered tooling.

### Stack

- **Next.js 16** (App Router, standalone output for Docker) + **React 19** + **TypeScript**
- **Drizzle ORM** + **PostgreSQL** (pgvector for embeddings, tsvector for full-text search)
- **NextAuth v5** (JWT strategy, GitHub + Google OAuth, dev mock auth)
- **Tailwind CSS v4** (OKLCH color tokens) + **shadcn/ui** (New York style, RSC enabled)
- **AI SDK** (`ai` package) with OpenAI, Anthropic, and Google providers
- **pnpm workspaces** monorepo: root app + `packages/cli`

### Key directories

- `app/api/` — REST API routes (37 route groups), all guarded by `withWorkspaceAuth()`
- `app/docs/` — Main editor interface (document editing, settings, OpenAPI management, analytics, approvals)
- `app/pub/[slug]` — Public documentation reader
- `lib/queries/` — 31 query modules, each exporting async functions scoped to `workspaceId`
- `lib/schema-*.ts` — 27 modular Drizzle schema files, barrel-exported from `lib/schema.ts`
- `lib/openapi/` — OpenAPI parsing, validation, diff, mock server generation, SDK generation
- `lib/search/` — Full-text search (tsvector) + semantic search (pgvector cosine similarity)
- `components/ui/` — shadcn/ui primitives; `components/docs/`, `components/settings/`, etc. for features
- `packages/cli/` — `@kite/cli` tool (login, pull, push, lint, publish, export)

### Multi-tenancy

Every data query is scoped to a `workspaceId`. The `withWorkspaceAuth(role)` function in `lib/api-utils.ts` is the single entry point for auth + role enforcement in all API routes. Role hierarchy: `guest < member < admin < owner`.

### RAG / AI pipeline

Documents are chunked (500 tokens), embedded (`text-embedding-3-small`), and stored in pgvector. Chat queries run through: vector search → context assembly → optional reranking → LLM streaming. Configuration constants live in `lib/ai-config.ts` and are overridable via `AI_*` env vars. See `RAG_PIPELINE_MAP.md` for the full flow diagram.

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

Error helpers: `unauthorized()` (401), `forbidden()` (403), `notFound()` (404), `badRequest(msg)` (400).

### Database queries

All in `lib/queries/*.ts`. Always scope to `workspaceId`. Use Drizzle's `eq()`, `and()`, `sql` operators. Soft deletes via `deletedAt` column. Single shared `db` instance from `lib/db.ts` (postgres.js driver, pool of 10).

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
import { cn } from '@/lib/utils'
```

### Error handling

Errors are captured fire-and-forget to the database via `captureError()` in `lib/error-collector.ts`. Use `logServerError(message, error, context)` from `lib/server-errors.ts` — it logs to console immediately and persists to DB without blocking.

### Schema changes

Add new tables in a dedicated `lib/schema-{domain}.ts` file, then re-export from `lib/schema.ts`. Run `pnpm db:push` to apply locally.

## Design Direction

Brand: Neutral · Professional · Accurate. Visual references: Stripe Docs, Notion, Vercel Docs.

- OKLCH color space: warm neutrals (hue 85–95°) for surfaces, cool blue (hue 244°) for interactive states only
- Both light and dark mode, fully supported
- Geist (sans) + Geist Mono fonts; base radius 0.375rem
- No heavy shadows, saturated fills, or decorative chrome — content density over decoration
- WCAG AA compliance required
