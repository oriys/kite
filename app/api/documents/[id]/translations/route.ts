import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  badRequest,
  notFound,
  forbidden,
} from '@/lib/api-utils'
import { getDocument } from '@/lib/queries/documents'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'
import {
  createTranslation,
  getTranslationsForDocument,
  SUPPORTED_LOCALES,
} from '@/lib/queries/translations'

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

  const translations = await getTranslationsForDocument(id)

  return NextResponse.json({
    currentLocale: doc.locale ?? 'en',
    translations: translations.map((t) => ({
      id: t.id,
      locale: t.locale,
      status: t.status,
      latestVersion: t.latestVersion
        ? {
            id: t.latestVersion.id,
            title: t.latestVersion.title,
            createdAt: t.latestVersion.createdAt,
          }
        : null,
    })),
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  const targetLocale =
    typeof body?.targetLocale === 'string' ? body.targetLocale.trim() : ''
  const title = typeof body?.title === 'string' ? body.title : ''
  const content = typeof body?.content === 'string' ? body.content : ''

  if (!targetLocale) return badRequest('targetLocale is required')
  if (!SUPPORTED_LOCALES.some((locale) => locale.code === targetLocale)) {
    return badRequest('Unsupported target locale')
  }

  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()
  if (targetLocale === (doc.locale ?? 'en')) {
    return badRequest('Target locale must be different from current locale')
  }

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canEdit) return forbidden()

  const created = await createTranslation({
    documentId: doc.id,
    locale: targetLocale,
    title: title || doc.title,
    content: content || doc.content,
    translatedBy: result.ctx.userId,
  })

  return NextResponse.json(created, { status: created.created ? 201 : 200 })
}
