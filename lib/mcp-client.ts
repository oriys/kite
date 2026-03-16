import { Client } from '@modelcontextprotocol/sdk/client'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import type { mcpServerConfigs } from '@/lib/schema'
import {
  MCP_CONNECTION_TIMEOUT_MS,
  MCP_TOOL_CALL_TIMEOUT_MS,
  MAX_MCP_RESOURCE_SIZE_BYTES,
} from '@/lib/ai-config'
import { parseMcpRemoteUrl, validateMcpStdioCommand } from '@/lib/mcp-transport'

type McpServerConfig = typeof mcpServerConfigs.$inferSelect

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
      validateMcpStdioCommand(config.command)
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
      return new SSEClientTransport(parseMcpRemoteUrl(config.url), {
        requestInit: {
          headers,
        },
      })
    }
    case 'streamable_http': {
      if (!config.url) throw new Error('Missing URL for streamable HTTP transport')
      const headers = (config.headers as Record<string, string>) ?? {}
      return new StreamableHTTPClientTransport(parseMcpRemoteUrl(config.url), {
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
): Promise<{
  ok: boolean
  toolCount: number
  promptCount: number
  resourceCount: number
  error?: string
}> {
  try {
    const client = await connectToServer(config)

    const [toolsRes, promptsRes, resourcesRes] = await Promise.allSettled([
      Promise.race([
        client.listTools(),
        rejectAfterTimeout('listTools'),
      ]),
      Promise.race([
        client.listPrompts(),
        rejectAfterTimeout('listPrompts'),
      ]),
      Promise.race([
        client.listResources(),
        rejectAfterTimeout('listResources'),
      ]),
    ])

    return {
      ok: true,
      toolCount:
        toolsRes.status === 'fulfilled'
          ? (toolsRes.value.tools?.length ?? 0)
          : 0,
      promptCount:
        promptsRes.status === 'fulfilled'
          ? (promptsRes.value.prompts?.length ?? 0)
          : 0,
      resourceCount:
        resourcesRes.status === 'fulfilled'
          ? (resourcesRes.value.resources?.length ?? 0)
          : 0,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Connection test failed'
    return { ok: false, toolCount: 0, promptCount: 0, resourceCount: 0, error: message }
  }
}

function rejectAfterTimeout(label: string) {
  return new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`MCP ${label} timed out`)),
      MCP_TOOL_CALL_TIMEOUT_MS,
    ),
  )
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export interface McpPromptDefinition {
  name: string
  description: string
  arguments: Array<{
    name: string
    description: string
    required: boolean
  }>
}

export interface McpPromptMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function listMcpServerPrompts(
  config: McpServerConfig,
): Promise<McpPromptDefinition[]> {
  const client = await connectToServer(config)

  const response = await Promise.race([
    client.listPrompts(),
    rejectAfterTimeout('listPrompts'),
  ])

  return (response.prompts ?? []).map((prompt) => ({
    name: prompt.name,
    description: prompt.description ?? '',
    arguments: (prompt.arguments ?? []).map((arg) => ({
      name: arg.name,
      description: arg.description ?? '',
      required: arg.required ?? false,
    })),
  }))
}

export async function getMcpPrompt(
  config: McpServerConfig,
  name: string,
  args?: Record<string, string>,
): Promise<{ description: string; messages: McpPromptMessage[] }> {
  const client = await connectToServer(config)

  const response = await Promise.race([
    client.getPrompt({ name, arguments: args }),
    rejectAfterTimeout('getPrompt'),
  ])

  const messages: McpPromptMessage[] = (response.messages ?? []).map((msg) => {
    let text = ''
    if (typeof msg.content === 'string') {
      text = msg.content
    } else if (msg.content && 'text' in msg.content) {
      text = (msg.content as { text: string }).text
    } else if (msg.content && 'type' in msg.content) {
      const c = msg.content as { type: string; text?: string }
      text = c.text ?? JSON.stringify(c)
    }
    return { role: msg.role, content: text }
  })

  return {
    description: response.description ?? '',
    messages,
  }
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export interface McpResourceDefinition {
  uri: string
  name: string
  description: string
  mimeType: string
}

export async function listMcpServerResources(
  config: McpServerConfig,
): Promise<McpResourceDefinition[]> {
  const client = await connectToServer(config)

  const response = await Promise.race([
    client.listResources(),
    rejectAfterTimeout('listResources'),
  ])

  return (response.resources ?? []).map((resource) => ({
    uri: resource.uri,
    name: resource.name,
    description: resource.description ?? '',
    mimeType: resource.mimeType ?? 'text/plain',
  }))
}

export async function readMcpResource(
  config: McpServerConfig,
  uri: string,
): Promise<{ uri: string; text: string; mimeType: string }> {
  const client = await connectToServer(config)

  const response = await Promise.race([
    client.readResource({ uri }),
    rejectAfterTimeout('readResource'),
  ])

  const content = response.contents?.[0]
  if (!content) {
    throw new Error(`Resource "${uri}" returned no content`)
  }

  // Only handle text content; reject binary
  if ('blob' in content) {
    throw new Error(`Resource "${uri}" returned binary content which is not supported`)
  }

  const text = (content as { text: string }).text ?? ''
  if (text.length > MAX_MCP_RESOURCE_SIZE_BYTES) {
    throw new Error(
      `Resource "${uri}" exceeds size limit (${text.length} bytes > ${MAX_MCP_RESOURCE_SIZE_BYTES})`,
    )
  }

  return {
    uri: content.uri,
    text,
    mimeType: content.mimeType ?? 'text/plain',
  }
}
