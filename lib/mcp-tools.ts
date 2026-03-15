import { jsonSchema, type ToolSet } from 'ai'

import { listEnabledMcpServerConfigs } from '@/lib/queries/mcp'
import {
  listMcpServerTools,
  executeMcpToolCall,
  type McpToolDefinition,
} from '@/lib/mcp-client'
import { MAX_MCP_TOOLS_PER_REQUEST } from '@/lib/ai-config'
import type { mcpServerConfigs } from '@/lib/schema'

type McpServerConfig = typeof mcpServerConfigs.$inferSelect

/**
 * Sanitize a server name into a valid tool-name prefix.
 * Replaces non-alphanumeric characters with underscores.
 */
function sanitizeNamespacePart(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40)
}

/**
 * Create an AI SDK tool entry from an MCP tool definition.
 */
function createMcpToolEntry(
  config: McpServerConfig,
  mcpTool: McpToolDefinition,
): ToolSet[string] {
  return {
    description: mcpTool.description || mcpTool.name,
    inputSchema: jsonSchema<Record<string, unknown>>(
      mcpTool.inputSchema as Parameters<typeof jsonSchema>[0],
    ),
    execute: async (args: Record<string, unknown>) => {
      const result = await executeMcpToolCall(config, mcpTool.name, args)
      if (result.isError) {
        return `[Tool error] ${JSON.stringify(result.content)}`
      }
      return typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content)
    },
  } as ToolSet[string]
}

/**
 * Build a Vercel AI SDK ToolSet from a single MCP server config.
 */
function buildToolSet(
  config: McpServerConfig,
  tools: McpToolDefinition[],
): ToolSet {
  const prefix = sanitizeNamespacePart(config.name)
  const toolSet: ToolSet = {}

  for (const mcpTool of tools) {
    const namespacedName = `${prefix}__${mcpTool.name}`
    toolSet[namespacedName] = createMcpToolEntry(config, mcpTool)
  }

  return toolSet
}

/**
 * Resolve MCP tools for a workspace.
 *
 * Connects to each enabled MCP server, lists its tools, and returns
 * a combined ToolSet ready for Vercel AI SDK `streamText()`.
 *
 * Returns `undefined` when no MCP servers are configured or no tools
 * were discovered, so callers can skip passing the `tools` option.
 */
export async function resolveWorkspaceMcpToolSet(
  workspaceId: string,
): Promise<ToolSet | undefined> {
  const configs = await listEnabledMcpServerConfigs(workspaceId)
  if (configs.length === 0) return undefined

  const merged: ToolSet = {}
  let totalTools = 0

  const results = await Promise.allSettled(
    configs.map(async (config) => {
      const tools = await listMcpServerTools(config)
      return { config, tools }
    }),
  )

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { config, tools } = result.value
    const subset = buildToolSet(config, tools)

    for (const [name, t] of Object.entries(subset)) {
      if (totalTools >= MAX_MCP_TOOLS_PER_REQUEST) break
      merged[name] = t
      totalTools++
    }
  }

  return totalTools > 0 ? merged : undefined
}
