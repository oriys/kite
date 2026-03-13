import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { getTemplate, updateTemplate, deleteTemplate } from '@/lib/queries/templates'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id } = await params
  const tpl = await getTemplate(id, result.ctx.workspaceId)
  if (!tpl) return notFound()

  return NextResponse.json(tpl)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') data.name = body.name.trim()
  if (typeof body.description === 'string') data.description = body.description
  if (body.category) data.category = body.category
  if (typeof body.content === 'string') data.content = body.content
  if ('thumbnail' in body) data.thumbnail = body.thumbnail

  const tpl = await updateTemplate(id, result.ctx.workspaceId, data)
  if (!tpl) return notFound()

  return NextResponse.json(tpl)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await params
  const deleted = await deleteTemplate(id, result.ctx.workspaceId)
  if (!deleted) return notFound()
  return NextResponse.json({ success: true })
}
