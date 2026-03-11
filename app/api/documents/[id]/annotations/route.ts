import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'
import {
  DOC_ANNOTATION_BODY_MAX_LENGTH,
  normalizeAnnotationQuote,
} from '@/lib/documents'
import {
  createDocumentAnnotation,
  listDocumentAnnotations,
} from '@/lib/queries/document-annotations'
import { getDocument } from '@/lib/queries/documents'

function parseCreateBody(body: Record<string, unknown>) {
  if (typeof body.body !== 'string') return null

  const text = body.body.trim()
  if (!text) return null
  if (text.length > DOC_ANNOTATION_BODY_MAX_LENGTH) return 'Annotation is too long'

  const quote =
    typeof body.quote === 'string'
      ? normalizeAnnotationQuote(body.quote)
      : ''

  return {
    body: text,
    quote,
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const annotations = await listDocumentAnnotations(id)
  return NextResponse.json(annotations)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!rawBody) return badRequest('Invalid JSON')

  const parsed = parseCreateBody(rawBody)
  if (!parsed) return badRequest('Annotation text is required')
  if (typeof parsed === 'string') return badRequest(parsed)

  const annotation = await createDocumentAnnotation(id, result.ctx.userId, parsed)
  if (!annotation) return badRequest('Failed to create annotation')

  return NextResponse.json(annotation, { status: 201 })
}
