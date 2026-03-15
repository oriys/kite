import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { getMcpServerConfig } from '@/lib/queries/mcp'
import { listMcpServerPrompts, getMcpPrompt } from '@/lib/mcp-client'

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
    const prompts = await listMcpServerPrompts(config)
    return NextResponse.json({ prompts })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to list prompts'
    return NextResponse.json({ error: message, prompts: [] }, { status: 502 })
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
  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: name' },
      { status: 400 },
    )
  }

  try {
    const prompt = await getMcpPrompt(config, body.name, body.arguments)
    return NextResponse.json(prompt)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to get prompt'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
