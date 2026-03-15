import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  withWorkspaceAuth,
  badRequest,
  forbidden,
  notFound,
} from '@/lib/api-utils'
import { getDocument } from '@/lib/queries/documents'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'
import { exportToMarkdown, exportToHtml } from '@/lib/export'
import { getWorkspaceBranding } from '@/lib/queries/branding'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const documentId = searchParams.get('documentId')
  const format = searchParams.get('format') ?? 'markdown'
  const theme = (searchParams.get('theme') ?? 'light') as 'light' | 'dark'

  if (!documentId) return badRequest('documentId is required')
  if (!['markdown', 'html', 'pdf', 'docx'].includes(format))
    return badRequest('Format must be markdown, html, pdf, or docx')

  const doc = await getDocument(documentId, result.ctx.workspaceId)
  if (!doc) return notFound()

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canView) return forbidden()

  if (format === 'markdown') {
    const md = exportToMarkdown(doc.title, doc.content)
    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': createContentDisposition(doc.title, 'md'),
      },
    })
  }

  if (format === 'html') {
    const html = exportToHtml(doc.title, doc.content, {
      standalone: true,
      theme,
    })
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': createContentDisposition(doc.title, 'html'),
      },
    })
  }

  const branding = await getWorkspaceBranding(result.ctx.workspaceId)
  const brandingOptions = branding
    ? {
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
      }
    : undefined

  if (format === 'pdf') {
    const { exportToPdf } = await import('@/lib/export-pdf')
    const buffer = await exportToPdf({
      title: doc.title,
      content: doc.content,
      branding: brandingOptions,
    })
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': createContentDisposition(doc.title, 'pdf'),
      },
    })
  }

  // docx
  const { exportToDocx } = await import('@/lib/export-docx')
  const buffer = await exportToDocx({
    title: doc.title,
    content: doc.content,
    branding: brandingOptions,
  })
  return new NextResponse(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': createContentDisposition(doc.title, 'docx'),
    },
  })
}

function encodeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'document'
}

function normalizeDownloadName(title: string) {
  return title
    .trim()
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || 'document'
}

function encodeRFC5987Value(value: string) {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function createContentDisposition(title: string, extension: 'md' | 'html' | 'pdf' | 'docx') {
  const normalizedTitle = normalizeDownloadName(title)
  const asciiFallback = `${encodeSlug(normalizedTitle)}.${extension}`
  const utf8Filename = `${normalizedTitle}.${extension}`

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRFC5987Value(
    utf8Filename,
  )}`
}
