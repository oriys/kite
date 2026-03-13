import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  notFound,
  badRequest,
  forbidden,
} from '@/lib/api-utils'
import {
  getDocument,
  updateDocument,
  deleteDocument,
} from '@/lib/queries/documents'
import {
  attachDocumentAccess,
  buildDocumentAccessMap,
} from '@/lib/queries/document-permissions'
import { MAX_TITLE_LENGTH, MAX_CONTENT_SIZE } from '@/lib/constants'
import { visibilityEnum } from '@/lib/schema'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canView) return forbidden()

  return NextResponse.json(attachDocumentAccess(doc, access))
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const patch: {
    title?: string
    content?: string
    visibility?: (typeof visibilityEnum.enumValues)[number]
  } = {}
  if (typeof body.title === 'string') patch.title = body.title
  if (typeof body.content === 'string') patch.content = body.content
  if (body.visibility !== undefined) {
    if (
      typeof body.visibility !== 'string'
      || !visibilityEnum.enumValues.includes(body.visibility as (typeof visibilityEnum.enumValues)[number])
    ) {
      return badRequest('Invalid visibility')
    }

    patch.visibility = body.visibility as (typeof visibilityEnum.enumValues)[number]
  }

  if (Object.keys(patch).length === 0) return badRequest('No valid fields')
  if (patch.title !== undefined && patch.title.length > MAX_TITLE_LENGTH) return badRequest('Title too long')
  if (patch.content !== undefined && patch.content.length > MAX_CONTENT_SIZE) return badRequest('Content too large')

  const existing = await getDocument(id, result.ctx.workspaceId)
  if (!existing) return notFound()

  const access = (
    await buildDocumentAccessMap([existing], result.ctx.userId, result.ctx.role)
  ).get(existing.id)
  if (!access?.canView) return forbidden()

  const includesContentChange = patch.title !== undefined || patch.content !== undefined
  if (includesContentChange && !access.canEdit) return forbidden()
  if (patch.visibility !== undefined && !access.canManagePermissions) {
    return forbidden()
  }

  const doc = await updateDocument(id, result.ctx.workspaceId, patch)
  if (!doc) return notFound()

  const updatedAccess = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)

  return NextResponse.json(attachDocumentAccess(doc, updatedAccess!))
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canDelete) return forbidden()

  const deleted = await deleteDocument(id, result.ctx.workspaceId)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}
