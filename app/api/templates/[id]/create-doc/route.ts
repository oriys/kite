import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { createDocumentFromTemplate } from '@/lib/queries/templates'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const title = typeof body?.title === 'string' ? body.title.trim() : undefined

  const doc = await createDocumentFromTemplate(
    id,
    result.ctx.workspaceId,
    result.ctx.userId,
    title,
  )

  if (!doc) return notFound()

  return NextResponse.json(doc, { status: 201 })
}
