import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import {
  updateAuthConfig,
  deleteAuthConfig,
} from '@/lib/queries/api-environments'

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
  if (body.authType) data.authType = body.authType
  if (typeof body.config === 'object') data.config = body.config

  const ac = await updateAuthConfig(id, data)
  if (!ac) return notFound()

  return NextResponse.json(ac)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await params
  await deleteAuthConfig(id)
  return NextResponse.json({ success: true })
}
