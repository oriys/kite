import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { duplicateDocument } from '@/lib/queries/documents'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await duplicateDocument(id, result.ctx.workspaceId, result.ctx.userId)
  if (!doc) return notFound()

  return NextResponse.json(doc, { status: 201 })
}
