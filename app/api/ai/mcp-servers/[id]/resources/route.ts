import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { getMcpServerConfig } from '@/lib/queries/mcp'
import { listMcpServerResources, readMcpResource } from '@/lib/mcp-client'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const config = await getMcpServerConfig(id, result.ctx.workspaceId)
  if (!config) return notFound()

  try {
    const resources = await listMcpServerResources(config)
    return NextResponse.json({ resources })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list resources'
    return NextResponse.json(
      { error: message, resources: [] },
      { status: 502 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const config = await getMcpServerConfig(id, result.ctx.workspaceId)
  if (!config) return notFound()

  const body = await request.json().catch(() => null)
  if (!body?.uri || typeof body.uri !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: uri' },
      { status: 400 },
    )
  }

  try {
    const resource = await readMcpResource(config, body.uri)
    return NextResponse.json(resource)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to read resource'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
