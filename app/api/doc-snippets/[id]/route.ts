import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  DOC_SNIPPET_CATEGORIES,
  normalizeDocSnippetKeywords,
  type DocSnippetCategory,
  type DocSnippetMutation,
} from '@/lib/doc-snippets'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import {
  deleteDocSnippet,
  getDocSnippet,
  updateDocSnippet,
} from '@/lib/queries/doc-snippets'

const MAX_LABEL_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 240
const MAX_TEMPLATE_LENGTH = 50_000
const MAX_KEYWORD_COUNT = 16
const MAX_KEYWORD_LENGTH = 32

function isDocSnippetCategory(value: string): value is DocSnippetCategory {
  return DOC_SNIPPET_CATEGORIES.includes(value as DocSnippetCategory)
}

function validateKeywords(keywords: string[]) {
  if (keywords.length > MAX_KEYWORD_COUNT) {
    return `Use at most ${MAX_KEYWORD_COUNT} keywords`
  }

  if (keywords.some((keyword) => keyword.length > MAX_KEYWORD_LENGTH)) {
    return `Keywords must be ${MAX_KEYWORD_LENGTH} characters or fewer`
  }

  return null
}

function parseSnippetPatch(body: Record<string, unknown>): Partial<DocSnippetMutation> {
  const patch: Partial<DocSnippetMutation> = {}

  if (typeof body.label === 'string') patch.label = body.label.trim()
  if (typeof body.description === 'string') patch.description = body.description.trim()
  if (typeof body.template === 'string') patch.template = body.template.trim()

  if (typeof body.category === 'string' && isDocSnippetCategory(body.category)) {
    patch.category = body.category
  }

  if (Array.isArray(body.keywords)) {
    patch.keywords = normalizeDocSnippetKeywords(
      body.keywords.filter((keyword): keyword is string => typeof keyword === 'string'),
    )
  }

  return patch
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id } = await context.params
  const snippet = await getDocSnippet(id, result.ctx.workspaceId)
  if (!snippet) return notFound()

  return NextResponse.json(snippet)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON')

  const patch = parseSnippetPatch(body as Record<string, unknown>)
  if (Object.keys(patch).length === 0) return badRequest('No valid fields')

  if (patch.label !== undefined) {
    if (!patch.label) return badRequest('Label is required')
    if (patch.label.length > MAX_LABEL_LENGTH) return badRequest('Label too long')
  }

  if (patch.description !== undefined) {
    if (!patch.description) return badRequest('Description is required')
    if (patch.description.length > MAX_DESCRIPTION_LENGTH) return badRequest('Description too long')
  }

  if (patch.template !== undefined) {
    if (!patch.template) return badRequest('Template is required')
    if (patch.template.length > MAX_TEMPLATE_LENGTH) return badRequest('Template too large')
  }

  if (patch.keywords !== undefined) {
    const keywordError = validateKeywords(patch.keywords)
    if (keywordError) return badRequest(keywordError)
  }

  const { id } = await context.params
  const updated = await updateDocSnippet(id, result.ctx.workspaceId, patch)
  if (!updated) return notFound()

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await context.params
  const deleted = await deleteDocSnippet(id, result.ctx.workspaceId)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}
