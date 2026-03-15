import { Client } from '@modelcontextprotocol/sdk/client'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import type { mcpServerConfigs } from '@/lib/schema'
import {
  MCP_CONNECTION_TIMEOUT_MS,
  MCP_TOOL_CALL_TIMEOUT_MS,
} from '@/lib/ai-config'

type McpServerConfig = typeof mcpServerConfigs.$inferSelect

// ---------------------------------------------------------------------------
// Stdio command whitelist
// ---------------------------------------------------------------------------

const ALLOWED_STDIO_COMMANDS = new Set([
  'node',
  'npx',
  'python',
  'python3',
  'uvx',
  'docker',
  'deno',
  'bun',
  'bunx',
])

function validateStdioCommand(command: string) {
  const binary = command.split('/').pop()?.split('\\').pop() ?? command
  if (!ALLOWED_STDIO_COMMANDS.has(binary)) {
    throw new Error(
      `Stdio command "${binary}" is not allowed. Permitted: ${[...ALLOWED_STDIO_COMMANDS].join(', ')}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Connection cache (5 min TTL, max 50 entries)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_SIZE = 50

interface CachedConnection {
  client: Client
  createdAt: number
}

const connectionCache = new Map<string, CachedConnection>()

function getCacheKey(config: McpServerConfig) {
  return `${config.id}:${config.updatedAt.getTime()}`
}

function getCachedClient(config: McpServerConfig): Client | null {
  const key = getCacheKey(config)
  const cached = connectionCache.get(key)
  if (!cached) return null

  if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
    cached.client.close().catch(() => {})
    connectionCache.delete(key)
    return null
  }

  return cached.client
}

function setCachedClient(config: McpServerConfig, client: Client) {
  const key = getCacheKey(config)
  // Evict old entry for same server id
  for (const [k, v] of connectionCache) {
    if (k.startsWith(config.id + ':') && k !== key) {
      v.client.close().catch(() => {})
      connectionCache.delete(k)
    }
  }

  // Evict stale entries and enforce max size
  evictStaleEntries()
  if (connectionCache.size >= CACHE_MAX_SIZE) {
    const oldest = connectionCache.keys().next().value
    if (oldest) {
      connectionCache.get(oldest)?.client.close().catch(() => {})
      connectionCache.delete(oldest)
    }
  }

  connectionCache.set(key, { client, createdAt: Date.now() })
}

function evictStaleEntries() {
  const now = Date.now()
  for (const [key, entry] of connectionCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      entry.client.close().catch(() => {})
      connectionCache.delete(key)
    }
  }
}

// ---------------------------------------------------------------------------
// Transport creation
// ---------------------------------------------------------------------------

function createTransport(config: McpServerConfig) {
  switch (config.transportType) {
    case 'stdio': {
      if (!config.command) throw new Error('Missing command for stdio transport')
      validateStdioCommand(config.command)
      const userEnv = (config.env as Record<string, string>) ?? {}
      const mergedEnv: Record<string, string> = {}
      for (const [k, v] of Object.entries(process.env)) {
        if (v !== undefined) mergedEnv[k] = v
      }
      Object.assign(mergedEnv, userEnv)
      return new StdioClientTransport({
        command: config.command,
        args: (config.args as string[]) ?? [],
        env: mergedEnv,
      })
    }
    case 'sse': {
      if (!config.url) throw new Error('Missing URL for SSE transport')
      const headers = (config.headers as Record<string, string>) ?? {}
      return new SSEClientTransport(new URL(config.url), {
        requestInit: {
          headers,
        },
      })
    }
    case 'streamable_http': {
      if (!config.url) throw new Error('Missing URL for streamable HTTP transport')
      const headers = (config.headers as Record<string, string>) ?? {}
      return new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: {
          headers,
        },
      })
    }
    default:
      throw new Error(`Unsupported transport type: ${config.transportType}`)
  }
}

// ---------------------------------------------------------------------------
// Connect (lazy, cached)
// ---------------------------------------------------------------------------

async function connectToServer(config: McpServerConfig): Promise<Client> {
  const existing = getCachedClient(config)
  if (existing) return existing

  const transport = createTransport(config)
  const client = new Client(
    { name: 'kite-mcp-client', version: '1.0.0' },
    { capabilities: {} },
  )

  await Promise.race([
    client.connect(transport),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('MCP connection timed out')),
        MCP_CONNECTION_TIMEOUT_MS,
      ),
    ),
  ])

  setCachedClient(config, client)
  return client
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export async function listMcpServerTools(
  config: McpServerConfig,
): Promise<McpToolDefinition[]> {
  const client = await connectToServer(config)

  const response = await Promise.race([
    client.listTools(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('MCP listTools timed out')),
        MCP_TOOL_CALL_TIMEOUT_MS,
      ),
    ),
  ])

  return (response.tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
  }))
}

export async function executeMcpToolCall(
  config: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ content: unknown; isError: boolean }> {
  const client = await connectToServer(config)

  const result = await Promise.race([
    client.callTool({ name: toolName, arguments: args }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`MCP tool call "${toolName}" timed out`)),
        MCP_TOOL_CALL_TIMEOUT_MS,
      ),
    ),
  ])

  return {
    content: result.content,
    isError: Boolean(result.isError),
  }
}

export async function testMcpServerConnection(
  config: McpServerConfig,
): Promise<{ ok: boolean; toolCount: number; error?: string }> {
  try {
    const tools = await listMcpServerTools(config)
    return { ok: true, toolCount: tools.length }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Connection test failed'
    return { ok: false, toolCount: 0, error: message }
  }
}
