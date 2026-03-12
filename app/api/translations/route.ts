import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  createTranslationLink,
  getTranslationsForDocument,
} from '@/lib/queries/translations'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const documentId = request.nextUrl.searchParams.get('documentId')
  if (!documentId) return badRequest('documentId is required')

  const translations = await getTranslationsForDocument(documentId)
  return NextResponse.json(translations)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { sourceDocumentId, translatedDocumentId, sourceLocale, targetLocale } = body

  if (!sourceDocumentId || !translatedDocumentId || !sourceLocale || !targetLocale)
    return badRequest('sourceDocumentId, translatedDocumentId, sourceLocale, and targetLocale are required')

  const link = await createTranslationLink(
    sourceDocumentId,
    translatedDocumentId,
    sourceLocale,
    targetLocale,
  )

  return NextResponse.json(link, { status: 201 })
}
