import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { getSsoConfigs, createSsoConfig } from '@/lib/queries/sso'

export async function GET() {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const configs = await getSsoConfigs(result.ctx.workspaceId)
  return NextResponse.json(configs)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { provider, displayName, issuerUrl, clientId, clientSecret, defaultRole, autoProvision, enforced } = body

  if (!provider || !displayName) {
    return badRequest('provider and displayName are required')
  }

  if (provider === 'oidc' && (!issuerUrl || !clientId || !clientSecret)) {
    return badRequest('OIDC requires issuerUrl, clientId, and clientSecret')
  }

  const config = await createSsoConfig({
    workspaceId: result.ctx.workspaceId,
    provider,
    displayName,
    issuerUrl: issuerUrl ?? null,
    clientId: clientId ?? null,
    clientSecret: clientSecret ?? null,
    defaultRole: defaultRole ?? 'member',
    autoProvision: autoProvision ?? true,
    enforced: enforced ?? false,
  })

  return NextResponse.json(config, { status: 201 })
}
