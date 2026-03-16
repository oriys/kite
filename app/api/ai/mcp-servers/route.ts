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
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import {
  normalizeOptionalString,
  parseJsonStringArray,
  parseJsonRecord,
} from '@/lib/mcp-parse'
import {
  parseMcpRemoteUrl,
  validateMcpStdioCommand,
} from '@/lib/mcp-transport'
import {
  createMcpServerConfig,
  listMcpServerConfigs,
  serializeMcpServerConfig,
} from '@/lib/queries/mcp'

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const rows = await listMcpServerConfigs(result.ctx.workspaceId)
  return NextResponse.json(rows.map(serializeMcpServerConfig))
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = normalizeOptionalString(body.name)
  const transportType = normalizeOptionalString(body.transportType)
  const command = normalizeOptionalString(body.command)
  const url = normalizeOptionalString(body.url)
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true

  if (!name) return badRequest('Server name is required')
  if (name.length > MAX_MCP_SERVER_NAME_LENGTH) {
    return badRequest('Server name is too long')
  }
  if (!isMcpTransportType(transportType)) {
    return badRequest('Invalid transport type')
  }

  if (transportType === 'stdio') {
    if (!command) return badRequest('Command is required for stdio transport')
    if (command.length > MAX_MCP_COMMAND_LENGTH) {
      return badRequest('Command is too long')
    }
    try {
      validateMcpStdioCommand(command)
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : 'Invalid command')
    }
  } else {
    if (!url) return badRequest('URL is required for SSE/HTTP transport')
    if (url.length > MAX_MCP_URL_LENGTH) {
      return badRequest('URL is too long')
    }
    try {
      parseMcpRemoteUrl(url)
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : 'Invalid URL')
    }
  }

  const args = parseJsonStringArray(body.args)
  if (args && args.length > MAX_MCP_ARGS_COUNT) {
    return badRequest(`Too many arguments (max ${MAX_MCP_ARGS_COUNT})`)
  }

  const env = parseJsonRecord(body.env)
  if (env && Object.keys(env).length > MAX_MCP_ENV_COUNT) {
    return badRequest(`Too many environment variables (max ${MAX_MCP_ENV_COUNT})`)
  }

  const headers = parseJsonRecord(body.headers)
  if (headers && Object.keys(headers).length > MAX_MCP_HEADERS_COUNT) {
    return badRequest(`Too many headers (max ${MAX_MCP_HEADERS_COUNT})`)
  }

  const config = await createMcpServerConfig(result.ctx.workspaceId, {
    name,
    transportType,
    command: command || null,
    args,
    env,
    url: url || null,
    headers,
    enabled,
  })

  return NextResponse.json(serializeMcpServerConfig(config), { status: 201 })
}
