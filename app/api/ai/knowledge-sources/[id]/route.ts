import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/schema'
import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await context.params

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const [existing] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, id),
        eq(knowledgeSources.workspaceId, result.ctx.workspaceId),
        isNull(knowledgeSources.deletedAt),
      ),
    )
    .limit(1)

  if (!existing) return notFound()

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.sourceUrl === 'string')
    updates.sourceUrl = body.sourceUrl.trim()
  if (typeof body.rawContent === 'string') updates.rawContent = body.rawContent
  if (body.metadata && typeof body.metadata === 'object')
    updates.metadata = body.metadata

  const [updated] = await db
    .update(knowledgeSources)
    .set(updates)
    .where(eq(knowledgeSources.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await context.params

  const [existing] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, id),
        eq(knowledgeSources.workspaceId, result.ctx.workspaceId),
        isNull(knowledgeSources.deletedAt),
      ),
    )
    .limit(1)

  if (!existing) return notFound()

  // Soft delete
  await db
    .update(knowledgeSources)
    .set({ deletedAt: new Date(), status: 'archived', updatedAt: new Date() })
    .where(eq(knowledgeSources.id, id))

  return NextResponse.json({ ok: true })
}
