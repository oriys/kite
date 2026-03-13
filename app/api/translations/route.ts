import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  badRequest,
  forbidden,
  notFound,
} from '@/lib/api-utils'
import {
  createTranslationLink,
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

  const translations = await getTranslationsForDocument(documentId)
  return NextResponse.json(translations)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { sourceDocumentId, translatedDocumentId, sourceLocale, targetLocale } = body

  if (!sourceDocumentId || !translatedDocumentId || !sourceLocale || !targetLocale)
    return badRequest('sourceDocumentId, translatedDocumentId, sourceLocale, and targetLocale are required')

  const sourceDocument = await getDocument(
    sourceDocumentId,
    result.ctx.workspaceId,
  )
  const translatedDocument = await getDocument(
    translatedDocumentId,
    result.ctx.workspaceId,
  )
  if (!sourceDocument || !translatedDocument) return notFound()

  const accessMap = await buildDocumentAccessMap(
    [sourceDocument, translatedDocument],
    result.ctx.userId,
    result.ctx.role,
  )

  if (
    !accessMap.get(sourceDocument.id)?.canEdit
    || !accessMap.get(translatedDocument.id)?.canEdit
  ) {
    return forbidden()
  }

  const link = await createTranslationLink(
    sourceDocumentId,
    translatedDocumentId,
    sourceLocale,
    targetLocale,
  )

  return NextResponse.json(link, { status: 201 })
}
