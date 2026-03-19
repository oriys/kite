import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { scheduledPublications } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return badRequest('Valid scheduledAt is required')
  }

  if (scheduledAt <= new Date()) {
    return badRequest('scheduledAt must be in the future')
  }

  const [scheduled] = await db
    .insert(scheduledPublications)
    .values({
      workspaceId: result.ctx.workspaceId,
      documentId: id,
      scheduledAt,
      createdBy: result.ctx.userId,
    })
    .returning()

  return NextResponse.json(scheduled, { status: 201 })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params

  const [cancelled] = await db
    .update(scheduledPublications)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(scheduledPublications.documentId, id),
        eq(scheduledPublications.workspaceId, result.ctx.workspaceId),
        eq(scheduledPublications.status, 'pending'),
      ),
    )
    .returning()

  if (!cancelled) return notFound()

  return NextResponse.json({ success: true })
}
