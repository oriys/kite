import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  listDocumentComments,
  createComment,
} from '@/lib/queries/inline-comments'

const MAX_BODY_LENGTH = 5000
const VALID_ANCHOR_TYPES = ['text_range', 'block_id'] as const

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const comments = await listDocumentComments(id)

  return NextResponse.json(comments)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  if (typeof body.body !== 'string' || body.body.trim().length === 0) {
    return badRequest('Comment body is required')
  }
  if (body.body.length > MAX_BODY_LENGTH) {
    return badRequest(`Comment body must be ${MAX_BODY_LENGTH} characters or fewer`)
  }
  if (
    !body.anchorType ||
    !(VALID_ANCHOR_TYPES as readonly string[]).includes(body.anchorType)
  ) {
    return badRequest('anchorType must be "text_range" or "block_id"')
  }

  const comment = await createComment({
    documentId: id,
    authorId: result.ctx.userId,
    anchorType: body.anchorType,
    anchorFrom: typeof body.anchorFrom === 'number' ? body.anchorFrom : undefined,
    anchorTo: typeof body.anchorTo === 'number' ? body.anchorTo : undefined,
    anchorBlockId: typeof body.anchorBlockId === 'string' ? body.anchorBlockId : undefined,
    quotedText: typeof body.quotedText === 'string' ? body.quotedText : undefined,
    body: body.body.trim(),
    parentId: typeof body.parentId === 'string' ? body.parentId : undefined,
  })

  return NextResponse.json(comment, { status: 201 })
}
