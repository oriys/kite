import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { listPartnerGroups, createPartnerGroup } from '@/lib/queries/partner-groups'

export async function GET() {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const groups = await listPartnerGroups(result.ctx.workspaceId)
  return NextResponse.json(groups)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('Name is required')
  if (name.length > 100) return badRequest('Name too long')

  const group = await createPartnerGroup(result.ctx.workspaceId, name)
  return NextResponse.json(group, { status: 201 })
}
