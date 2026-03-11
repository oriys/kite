import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'
import {
  DOC_EVALUATION_BODY_MAX_LENGTH,
  isDocEvaluationScore,
} from '@/lib/documents'
import {
  createDocumentEvaluation,
  listDocumentEvaluations,
} from '@/lib/queries/document-evaluations'
import { getDocument } from '@/lib/queries/documents'

function parseCreateBody(body: Record<string, unknown>) {
  if (typeof body.body !== 'string') return null

  const text = body.body.trim()
  if (!text) return null
  if (text.length > DOC_EVALUATION_BODY_MAX_LENGTH) return 'Evaluation is too long'

  const score = typeof body.score === 'number' ? body.score : Number(body.score)
  if (!isDocEvaluationScore(score)) return 'Score must be between 1 and 5'

  return {
    score,
    body: text,
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const evaluations = await listDocumentEvaluations(id)
  return NextResponse.json(evaluations)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!rawBody) return badRequest('Invalid JSON')

  const parsed = parseCreateBody(rawBody)
  if (!parsed) return badRequest('Evaluation text is required')
  if (typeof parsed === 'string') return badRequest(parsed)

  const evaluation = await createDocumentEvaluation(id, result.ctx.userId, parsed)
  if (!evaluation) return badRequest('Failed to create evaluation')

  return NextResponse.json(evaluation, { status: 201 })
}
