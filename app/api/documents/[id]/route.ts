import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  notFound,
  badRequest,
  forbidden,
} from '@/lib/api-utils'
import { recordDomainEvent } from '@/lib/observability/metrics'
import { withRouteObservability } from '@/lib/observability/route-handler'
import {
  getDocumentByIdentifier,
  updateDocument,
  deleteDocument,
} from '@/lib/queries/documents'
import {
  attachDocumentAccess,
  buildDocumentAccessMap,
} from '@/lib/queries/document-permissions'
import {
  MAX_TITLE_LENGTH,
  MAX_CONTENT_SIZE,
  MAX_DOCUMENT_CATEGORY_LENGTH,
  MAX_DOCUMENT_TAG_COUNT,
  MAX_DOCUMENT_TAG_LENGTH,
} from '@/lib/constants'
import { coerceDocumentTagsInput } from '@/lib/documents'
import { visibilityEnum } from '@/lib/schema'

async function getDocumentRoute(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocumentByIdentifier(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canView) return forbidden()

  return NextResponse.json(attachDocumentAccess(doc, access))
}

async function patchDocumentRoute(
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
    slug?: string
    category?: string
    tags?: string[]
    content?: string
    visibility?: (typeof visibilityEnum.enumValues)[number]
  } = {}
  if (typeof body.title === 'string') patch.title = body.title
  if (typeof body.slug === 'string') patch.slug = body.slug
  if (typeof body.category === 'string') patch.category = body.category.trim()
  if (body.tags !== undefined) {
    const tags = coerceDocumentTagsInput(body.tags)
    if (tags === null) {
      return badRequest('Invalid tags')
    }
    patch.tags = tags
  }
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
  if (patch.category !== undefined && patch.category.length > MAX_DOCUMENT_CATEGORY_LENGTH) {
    return badRequest('Category too long')
  }
  if (patch.tags !== undefined && patch.tags.length > MAX_DOCUMENT_TAG_COUNT) {
    return badRequest('Too many tags')
  }
  if (patch.tags !== undefined && patch.tags.some((tag) => tag.length > MAX_DOCUMENT_TAG_LENGTH)) {
    return badRequest('Tag too long')
  }
  if (patch.content !== undefined && patch.content.length > MAX_CONTENT_SIZE) return badRequest('Content too large')

  const existing = await getDocumentByIdentifier(id, result.ctx.workspaceId)
  if (!existing) return notFound()

  const access = (
    await buildDocumentAccessMap([existing], result.ctx.userId, result.ctx.role)
  ).get(existing.id)
  if (!access?.canView) return forbidden()

  const includesContentChange =
    patch.title !== undefined ||
    patch.slug !== undefined ||
    patch.category !== undefined ||
    patch.tags !== undefined ||
    patch.content !== undefined
  if (includesContentChange && !access.canEdit) return forbidden()
  if (patch.visibility !== undefined && !access.canManagePermissions) {
    return forbidden()
  }

  const doc = await updateDocument(existing.id, result.ctx.workspaceId, patch)
  if (!doc) return notFound()

  const updatedAccess = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)

  recordDomainEvent('document_update')
  return NextResponse.json(attachDocumentAccess(doc, updatedAccess!))
}

async function deleteDocumentRoute(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocumentByIdentifier(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canDelete) return forbidden()

  const deleted = await deleteDocument(doc.id, result.ctx.workspaceId)
  if (!deleted) return notFound()

  recordDomainEvent('document_delete')
  return NextResponse.json({ ok: true })
}

export const GET = withRouteObservability(getDocumentRoute, {
  route: '/api/documents/:id',
})

export const PATCH = withRouteObservability(patchDocumentRoute, {
  route: '/api/documents/:id',
})

export const DELETE = withRouteObservability(deleteDocumentRoute, {
  route: '/api/documents/:id',
})
