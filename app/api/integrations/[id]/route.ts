import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { integrations } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.workspaceId, result.ctx.workspaceId),
    ),
  })

  if (!integration) return notFound()
  return NextResponse.json(integration)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const data: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof body.displayName === 'string') data.displayName = body.displayName.trim()
  if (body.config && typeof body.config === 'object') data.config = body.config
  if (Array.isArray(body.events)) data.events = body.events
  if (typeof body.enabled === 'boolean') data.enabled = body.enabled
  if (typeof body.status === 'string') {
    data.status = body.status
    data.statusMessage = body.statusMessage ?? null
  }

  const [updated] = await db
    .update(integrations)
    .set(data)
    .where(
      and(
        eq(integrations.id, id),
        eq(integrations.workspaceId, result.ctx.workspaceId),
      ),
    )
    .returning()

  if (!updated) return notFound()
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const [deleted] = await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.id, id),
        eq(integrations.workspaceId, result.ctx.workspaceId),
      ),
    )
    .returning()

  if (!deleted) return notFound()
  return NextResponse.json({ success: true })
}
