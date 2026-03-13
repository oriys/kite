import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  createAuthConfig,
  listAuthConfigs,
} from '@/lib/queries/api-environments'

function serializeAuthConfigSummary(config: {
  id: string
  workspaceId: string
  name: string
  authType: 'none' | 'bearer' | 'api_key' | 'basic' | 'oauth2'
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: config.id,
    workspaceId: config.workspaceId,
    name: config.name,
    authType: config.authType,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }
}

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const items = await listAuthConfigs(result.ctx.workspaceId)
  return NextResponse.json(items.map((item) => serializeAuthConfigSummary(item)))
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const authType = body.authType
  const config =
    typeof body.config === 'object' && body.config !== null ? body.config : {}

  if (!name) return badRequest('Name is required')
  if (!['none', 'bearer', 'api_key', 'basic', 'oauth2'].includes(authType))
    return badRequest('Invalid auth type')

  const ac = await createAuthConfig(
    result.ctx.workspaceId,
    name,
    authType,
    config,
  )

  return NextResponse.json(serializeAuthConfigSummary(ac), { status: 201 })
}
