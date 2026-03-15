import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  MAX_MCP_SERVER_NAME_LENGTH,
  MAX_MCP_COMMAND_LENGTH,
  MAX_MCP_URL_LENGTH,
  MAX_MCP_ARGS_COUNT,
  MAX_MCP_ENV_COUNT,
  MAX_MCP_HEADERS_COUNT,
  isMcpTransportType,
} from '@/lib/ai'
import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'
import {
  normalizeOptionalString,
  parseJsonStringArray,
  parseJsonRecord,
} from '@/lib/mcp-parse'
import {
  deleteMcpServerConfig,
  getMcpServerConfig,
  serializeMcpServerConfig,
  updateMcpServerConfig,
} from '@/lib/queries/mcp'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const existing = await getMcpServerConfig(id, result.ctx.workspaceId)
  if (!existing) return notFound()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const patch: Parameters<typeof updateMcpServerConfig>[2] = {}

  if (typeof body.name === 'string') {
    const name = normalizeOptionalString(body.name)
    if (!name) return badRequest('Server name is required')
    if (name.length > MAX_MCP_SERVER_NAME_LENGTH) {
      return badRequest('Server name is too long')
    }
    patch.name = name
  }

  if (typeof body.transportType === 'string') {
    const transportType = normalizeOptionalString(body.transportType)
    if (!isMcpTransportType(transportType)) {
      return badRequest('Invalid transport type')
    }
    patch.transportType = transportType
  }

  if (typeof body.command === 'string') {
    const command = normalizeOptionalString(body.command)
    if (command.length > MAX_MCP_COMMAND_LENGTH) {
      return badRequest('Command is too long')
    }
    patch.command = command || null
  }

  if (typeof body.url === 'string') {
    const url = normalizeOptionalString(body.url)
    if (url.length > MAX_MCP_URL_LENGTH) {
      return badRequest('URL is too long')
    }
    patch.url = url || null
  }

  if (body.args !== undefined) {
    const args = parseJsonStringArray(body.args)
    if (args && args.length > MAX_MCP_ARGS_COUNT) {
      return badRequest(`Too many arguments (max ${MAX_MCP_ARGS_COUNT})`)
    }
    patch.args = args
  }

  if (body.env !== undefined) {
    const env = parseJsonRecord(body.env)
    if (env && Object.keys(env).length > MAX_MCP_ENV_COUNT) {
      return badRequest(`Too many environment variables (max ${MAX_MCP_ENV_COUNT})`)
    }
    patch.env = env
  }

  if (body.headers !== undefined) {
    const headers = parseJsonRecord(body.headers)
    if (headers && Object.keys(headers).length > MAX_MCP_HEADERS_COUNT) {
      return badRequest(`Too many headers (max ${MAX_MCP_HEADERS_COUNT})`)
    }
    patch.headers = headers
  }

  if (typeof body.enabled === 'boolean') {
    patch.enabled = body.enabled
  }

  const config = await updateMcpServerConfig(id, result.ctx.workspaceId, patch)
  if (!config) return notFound()

  return NextResponse.json(serializeMcpServerConfig(config))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const existing = await getMcpServerConfig(id, result.ctx.workspaceId)
  if (!existing) return notFound()

  await deleteMcpServerConfig(id, result.ctx.workspaceId)
  return NextResponse.json({ success: true })
}
