import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'
import {
  DOC_ANNOTATION_BODY_MAX_LENGTH,
  type DocAnnotationStatus,
} from '@/lib/documents'
import {
  deleteDocumentAnnotation,
  updateDocumentAnnotation,
} from '@/lib/queries/document-annotations'
import { getDocument } from '@/lib/queries/documents'

function isAnnotationStatus(value: string): value is DocAnnotationStatus {
  return value === 'open' || value === 'resolved'
}

function parsePatchBody(body: Record<string, unknown>) {
  const patch: {
    body?: string
    status?: DocAnnotationStatus
  } = {}

  if (typeof body.body === 'string') {
    const nextBody = body.body.trim()
    if (!nextBody) return 'Annotation text is required'
    if (nextBody.length > DOC_ANNOTATION_BODY_MAX_LENGTH) return 'Annotation is too long'
    patch.body = nextBody
  }

  if (typeof body.status === 'string') {
    if (!isAnnotationStatus(body.status)) return 'Invalid annotation status'
    patch.status = body.status
  }

  if (!patch.body && !patch.status) return null
  return patch
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; annotationId: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id, annotationId } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!rawBody) return badRequest('Invalid JSON')

  const patch = parsePatchBody(rawBody)
  if (!patch) return badRequest('No valid fields')
  if (typeof patch === 'string') return badRequest(patch)

  const annotation = await updateDocumentAnnotation(annotationId, id, patch)
  if (!annotation) return notFound()

  return NextResponse.json(annotation)
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; annotationId: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id, annotationId } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const deleted = await deleteDocumentAnnotation(annotationId, id)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}
