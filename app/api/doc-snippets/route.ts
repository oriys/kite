import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  DOC_SNIPPET_CATEGORIES,
  normalizeDocSnippetKeywords,
  type DocSnippetCategory,
  type DocSnippetMutation,
} from '@/lib/doc-snippets'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { createDocSnippet, listDocSnippets } from '@/lib/queries/doc-snippets'
import {
  MAX_LABEL_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TEMPLATE_LENGTH,
  MAX_KEYWORD_COUNT,
  MAX_KEYWORD_LENGTH,
} from '@/lib/constants'

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

function parseSnippetBody(body: Record<string, unknown>): DocSnippetMutation | null {
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const category = typeof body.category === 'string' ? body.category : ''
  const template = typeof body.template === 'string' ? body.template.trim() : ''
  const keywords = normalizeDocSnippetKeywords(
    Array.isArray(body.keywords)
      ? body.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
      : [],
  )

  if (!label || !description || !template || !isDocSnippetCategory(category)) {
    return null
  }

  return {
    label,
    description,
    category,
    keywords,
    template,
  }
}

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const snippets = await listDocSnippets(result.ctx.workspaceId)
  return NextResponse.json(snippets)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON')

  const snippet = parseSnippetBody(body as Record<string, unknown>)
  if (!snippet) {
    return badRequest('Label, description, category, and template are required')
  }

  if (snippet.label.length > MAX_LABEL_LENGTH) return badRequest('Label too long')
  if (snippet.description.length > MAX_DESCRIPTION_LENGTH) return badRequest('Description too long')
  if (snippet.template.length > MAX_TEMPLATE_LENGTH) return badRequest('Template too large')

  const keywordError = validateKeywords(snippet.keywords)
  if (keywordError) return badRequest(keywordError)

  const created = await createDocSnippet(result.ctx.workspaceId, snippet)
  return NextResponse.json(created, { status: 201 })
}
