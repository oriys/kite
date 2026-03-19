import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  badRequest,
  forbidden,
  notFound,
} from '@/lib/api-utils'
import {
  createTranslation,
  getTranslationsForDocument,
} from '@/lib/queries/translations'
import { getDocument } from '@/lib/queries/documents'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const documentId = request.nextUrl.searchParams.get('documentId')
  if (!documentId) return badRequest('documentId is required')

  const document = await getDocument(documentId, result.ctx.workspaceId)
  if (!document) return notFound()

  const access = (
    await buildDocumentAccessMap([document], result.ctx.userId, result.ctx.role)
  ).get(document.id)
  if (!access?.canView) return forbidden()

  const translations = await getTranslationsForDocument(result.ctx.workspaceId, documentId)
  return NextResponse.json(translations)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { documentId, locale, title, content } = body

  if (!documentId || !locale) {
    return badRequest('documentId and locale are required')
  }

  const document = await getDocument(documentId, result.ctx.workspaceId)
  if (!document) return notFound()

  const access = (
    await buildDocumentAccessMap([document], result.ctx.userId, result.ctx.role)
  ).get(document.id)
  if (!access?.canEdit) return forbidden()

  const created = await createTranslation(result.ctx.workspaceId, {
    documentId,
    locale,
    title: title || document.title,
    content: content || document.content,
    translatedBy: result.ctx.userId,
  })

  return NextResponse.json(created, { status: created.created ? 201 : 200 })
}
