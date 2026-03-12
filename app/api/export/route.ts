import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { documents } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { exportToMarkdown, exportToHtml } from '@/lib/export'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const documentId = searchParams.get('documentId')
  const format = searchParams.get('format') ?? 'markdown'
  const theme = (searchParams.get('theme') ?? 'light') as 'light' | 'dark'

  if (!documentId) return badRequest('documentId is required')
  if (!['markdown', 'html'].includes(format))
    return badRequest('Format must be markdown or html')

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  })
  if (!doc) return notFound()

  if (format === 'markdown') {
    const md = exportToMarkdown(doc.title, doc.content)
    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeSlug(doc.title)}.md"`,
      },
    })
  }

  const html = exportToHtml(doc.title, doc.content, {
    standalone: true,
    theme,
  })
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeSlug(doc.title)}.html"`,
    },
  })
}

function encodeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'document'
}
