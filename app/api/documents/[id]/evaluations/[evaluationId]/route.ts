import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'
import {
  DOC_EVALUATION_BODY_MAX_LENGTH,
  isDocEvaluationScore,
} from '@/lib/documents'
import {
  deleteDocumentEvaluation,
  updateDocumentEvaluation,
} from '@/lib/queries/document-evaluations'
import { getDocument } from '@/lib/queries/documents'

function parsePatchBody(body: Record<string, unknown>) {
  const patch: {
    score?: number
    body?: string
  } = {}

  if (typeof body.body === 'string') {
    const nextBody = body.body.trim()
    if (!nextBody) return 'Evaluation text is required'
    if (nextBody.length > DOC_EVALUATION_BODY_MAX_LENGTH) return 'Evaluation is too long'
    patch.body = nextBody
  }

  if (body.score !== undefined) {
    const score = typeof body.score === 'number' ? body.score : Number(body.score)
    if (!isDocEvaluationScore(score)) return 'Score must be between 1 and 5'
    patch.score = score
  }

  if (patch.body === undefined && patch.score === undefined) return null
  return patch
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; evaluationId: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id, evaluationId } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!rawBody) return badRequest('Invalid JSON')

  const patch = parsePatchBody(rawBody)
  if (!patch) return badRequest('No valid fields')
  if (typeof patch === 'string') return badRequest(patch)

  const evaluation = await updateDocumentEvaluation(evaluationId, id, patch)
  if (!evaluation) return notFound()

  return NextResponse.json(evaluation)
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; evaluationId: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id, evaluationId } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const deleted = await deleteDocumentEvaluation(evaluationId, id)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}
