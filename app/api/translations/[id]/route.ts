import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { documents } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import {
  updateTranslationStatus,
  deleteTranslation,
  getTranslation,
  getLatestTranslationVersion,
  getTranslationVersions,
  addTranslationVersion,
} from '@/lib/queries/translations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await params
  const translation = await getTranslation(result.ctx.workspaceId, id)
  if (!translation) return notFound()

  // Verify translation belongs to this workspace
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, translation.documentId), eq(documents.workspaceId, result.ctx.workspaceId), isNull(documents.deletedAt)),
    columns: { id: true },
  })
  if (!doc) return notFound()

  const [latestVersion, versions] = await Promise.all([
    getLatestTranslationVersion(result.ctx.workspaceId, id),
    getTranslationVersions(result.ctx.workspaceId, id),
  ])

  return NextResponse.json({
    ...translation,
    latestVersion,
    versions,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)

  const translation = await getTranslation(result.ctx.workspaceId, id)
  if (!translation) return notFound()
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, translation.documentId), eq(documents.workspaceId, result.ctx.workspaceId), isNull(documents.deletedAt)),
    columns: { id: true },
  })
  if (!doc) return notFound()

  // Update status
  if (body?.status) {
    const updated = await updateTranslationStatus(result.ctx.workspaceId, id, body.status)
    if (!updated) return notFound()
    return NextResponse.json(updated)
  }

  // Add a new version
  if (body?.title !== undefined || body?.content !== undefined) {
    const latest = await getLatestTranslationVersion(result.ctx.workspaceId, id)
    const version = await addTranslationVersion(result.ctx.workspaceId, {
      translationId: id,
      title: typeof body.title === 'string' ? body.title : (latest?.title ?? ''),
      content: typeof body.content === 'string' ? body.content : (latest?.content ?? ''),
      translatedBy: result.ctx.userId,
    })

    return NextResponse.json(version)
  }

  return badRequest('Provide status, or title/content for a new version')
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params

  const translation = await getTranslation(result.ctx.workspaceId, id)
  if (!translation) return notFound()
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, translation.documentId), eq(documents.workspaceId, result.ctx.workspaceId), isNull(documents.deletedAt)),
    columns: { id: true },
  })
  if (!doc) return notFound()

  await deleteTranslation(result.ctx.workspaceId, id)
  return NextResponse.json({ success: true })
}
