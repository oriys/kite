import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { badRequest } from '@/lib/api-utils'
import { submitFeedback } from '@/lib/queries/feedback'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { documentId, isHelpful, comment } = body

  if (typeof documentId !== 'string' || !documentId.trim()) {
    return badRequest('documentId is required')
  }

  if (typeof isHelpful !== 'boolean') {
    return badRequest('isHelpful must be a boolean')
  }

  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') return badRequest('comment must be a string')
    if (comment.length > 1000) return badRequest('comment must be 1000 characters or less')
  }

  const result = await submitFeedback({
    documentId,
    isHelpful,
    comment: comment ?? undefined,
  })

  return NextResponse.json(result, { status: 201 })
}
