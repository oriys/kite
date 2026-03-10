import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { listDocuments, createDocument } from '@/lib/queries/documents'

const VALID_STATUSES = ['draft', 'review', 'published', 'archived'] as const
const MAX_TITLE_LENGTH = 255
const MAX_CONTENT_SIZE = 10 * 1024 * 1024 // 10 MB

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')

  if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return badRequest('Invalid status filter')
  }

  const docs = await listDocuments(
    result.ctx.workspaceId,
    (status as (typeof VALID_STATUSES)[number]) ?? undefined,
  )
  return NextResponse.json(docs)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content : ''

  if (title.length > MAX_TITLE_LENGTH) return badRequest('Title too long')
  if (content.length > MAX_CONTENT_SIZE) return badRequest('Content too large')

  const doc = await createDocument(
    result.ctx.workspaceId,
    title || 'Untitled',
    content,
    result.ctx.userId,
  )

  return NextResponse.json(doc, { status: 201 })
}
