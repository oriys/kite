import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { getSsoConfig, updateSsoConfig, deleteSsoConfig } from '@/lib/queries/sso'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const config = await getSsoConfig(id)
  if (!config || config.workspaceId !== result.ctx.workspaceId) {
    return notFound()
  }

  return NextResponse.json(config)
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const existing = await getSsoConfig(id)
  if (!existing || existing.workspaceId !== result.ctx.workspaceId) {
    return notFound()
  }

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const config = await updateSsoConfig(id, {
    displayName: body.displayName,
    issuerUrl: body.issuerUrl,
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    defaultRole: body.defaultRole,
    autoProvision: body.autoProvision,
    enforced: body.enforced,
    enabled: body.enabled,
  })

  return NextResponse.json(config)
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const existing = await getSsoConfig(id)
  if (!existing || existing.workspaceId !== result.ctx.workspaceId) {
    return notFound()
  }

  await deleteSsoConfig(id)
  return NextResponse.json({ success: true })
}
