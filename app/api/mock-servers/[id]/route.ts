import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { mockServerConfigs, mockRequestLogs } from '@/lib/schema-mock'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult
  const { id } = await params

  const config = await db.query.mockServerConfigs.findFirst({
    where: and(
      eq(mockServerConfigs.id, id),
      eq(mockServerConfigs.workspaceId, ctx.workspaceId),
    ),
  })
  if (!config) return notFound()

  const logs = await db
    .select()
    .from(mockRequestLogs)
    .where(eq(mockRequestLogs.configId, id))
    .orderBy(desc(mockRequestLogs.createdAt))
    .limit(50)

  return NextResponse.json({ ...config, logs })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult
  const { id } = await params

  const existing = await db.query.mockServerConfigs.findFirst({
    where: and(
      eq(mockServerConfigs.id, id),
      eq(mockServerConfigs.workspaceId, ctx.workspaceId),
    ),
  })
  if (!existing) return notFound()

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled
  if (typeof body.delay === 'number') updates.delay = Math.max(0, Math.min(body.delay, 30000))
  if (typeof body.errorRate === 'number') updates.errorRate = Math.max(0, Math.min(body.errorRate, 1))
  if (body.seed !== undefined) updates.seed = body.seed === null ? null : Number(body.seed)
  if (body.overrides !== undefined) updates.overrides = body.overrides

  const [updated] = await db
    .update(mockServerConfigs)
    .set(updates)
    .where(eq(mockServerConfigs.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('admin')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult
  const { id } = await params

  const existing = await db.query.mockServerConfigs.findFirst({
    where: and(
      eq(mockServerConfigs.id, id),
      eq(mockServerConfigs.workspaceId, ctx.workspaceId),
    ),
  })
  if (!existing) return notFound()

  await db.delete(mockServerConfigs).where(eq(mockServerConfigs.id, id))

  return NextResponse.json({ success: true })
}
