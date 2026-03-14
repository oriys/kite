import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import {
  getEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from '@/lib/queries/api-environments'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const env = await getEnvironment(id, result.ctx.workspaceId)
  if (!env) return notFound()

  return NextResponse.json(env)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') data.name = body.name.trim()
  if (typeof body.baseUrl === 'string') data.baseUrl = body.baseUrl.trim()
  if (typeof body.variables === 'object') data.variables = body.variables
  if (typeof body.isDefault === 'boolean') data.isDefault = body.isDefault

  const env = await updateEnvironment(id, result.ctx.workspaceId, data)
  if (!env) return notFound()

  return NextResponse.json(env)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  await deleteEnvironment(id, result.ctx.workspaceId)
  return NextResponse.json({ success: true })
}
