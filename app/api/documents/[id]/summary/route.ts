import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { generateDocumentSummary } from '@/lib/document-summary'
import {
  getDocument,
  updateDocumentSummary,
} from '@/lib/queries/documents'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const summary = await generateDocumentSummary({
    title: doc.title,
    content: doc.content,
  })

  const updated = await updateDocumentSummary(id, result.ctx.workspaceId, summary)
  if (!updated) return notFound()

  return NextResponse.json({
    id: updated.id,
    summary: updated.summary,
  })
}
