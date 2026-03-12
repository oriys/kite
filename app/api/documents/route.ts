import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { listDocuments, createDocument } from '@/lib/queries/documents'
import { isValidStatus, MAX_TITLE_LENGTH, MAX_CONTENT_SIZE } from '@/lib/constants'
import type { DocStatus } from '@/lib/documents'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const rawStatus = searchParams.get('status')
  const rawApiVersionId = searchParams.get('api_version_id')

  let statusFilter: DocStatus | undefined
  if (rawStatus) {
    if (!isValidStatus(rawStatus)) return badRequest('Invalid status filter')
    statusFilter = rawStatus
  }

  const docs = await listDocuments(result.ctx.workspaceId, statusFilter, 100, 0, rawApiVersionId ?? undefined)
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
