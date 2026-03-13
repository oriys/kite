import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  createEnvironment,
  listEnvironments,
} from '@/lib/queries/api-environments'

function serializeEnvironmentSummary(environment: {
  id: string
  workspaceId: string
  name: string
  baseUrl: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: environment.id,
    workspaceId: environment.workspaceId,
    name: environment.name,
    baseUrl: environment.baseUrl,
    isDefault: environment.isDefault,
    createdAt: environment.createdAt,
    updatedAt: environment.updatedAt,
  }
}

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const items = await listEnvironments(result.ctx.workspaceId)
  return NextResponse.json(items.map((item) => serializeEnvironmentSummary(item)))
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : ''
  const variables =
    typeof body.variables === 'object' && body.variables !== null
      ? body.variables
      : {}

  if (!name) return badRequest('Name is required')
  if (!baseUrl) return badRequest('Base URL is required')

  const env = await createEnvironment(
    result.ctx.workspaceId,
    name,
    baseUrl,
    variables,
  )

  return NextResponse.json(serializeEnvironmentSummary(env), { status: 201 })
}
