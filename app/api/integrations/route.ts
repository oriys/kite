import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { integrations } from '@/lib/schema'
import { eq } from 'drizzle-orm'

const VALID_PROVIDERS = ['slack', 'github', 'jira'] as const
type Provider = (typeof VALID_PROVIDERS)[number]

export async function GET() {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const items = await db.query.integrations.findMany({
    where: eq(integrations.workspaceId, result.ctx.workspaceId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const provider = body.provider as Provider
  if (!VALID_PROVIDERS.includes(provider)) {
    return badRequest('Invalid provider. Must be slack, github, or jira.')
  }

  const displayName =
    typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (!displayName || displayName.length > 100) {
    return badRequest('Display name is required (max 100 chars)')
  }

  const config = body.config
  if (!config || typeof config !== 'object') {
    return badRequest('Config is required')
  }

  const events = Array.isArray(body.events) ? body.events : []
  if (events.length === 0) {
    return badRequest('At least one event subscription is required')
  }

  const [created] = await db
    .insert(integrations)
    .values({
      workspaceId: result.ctx.workspaceId,
      provider,
      displayName,
      config,
      events,
      createdBy: result.ctx.userId,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
