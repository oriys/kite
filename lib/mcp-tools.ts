import { jsonSchema, type ToolSet } from 'ai'

import { listEnabledMcpServerConfigs } from '@/lib/queries/mcp'
import {
  listMcpServerTools,
  listMcpServerResources,
  readMcpResource,
  executeMcpToolCall,
  type McpToolDefinition,
  type McpResourceDefinition,
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
 * Build resource-browsing tools for a single MCP server.
 * Creates `{prefix}__list_resources` and `{prefix}__read_resource`.
 */
function buildResourceToolSet(
  config: McpServerConfig,
  resources: McpResourceDefinition[],
): ToolSet {
  const prefix = sanitizeNamespacePart(config.name)
  const toolSet: ToolSet = {}

  const resourceList = resources
    .map((r) => `- ${r.uri} (${r.name}: ${r.description || r.mimeType})`)
    .join('\n')

  toolSet[`${prefix}__list_resources`] = {
    description: `List available resources from ${config.name}. Returns URIs and descriptions of data this server exposes.`,
    inputSchema: jsonSchema<Record<string, unknown>>({
      type: 'object' as const,
      properties: {},
    }),
    execute: async () => resourceList || 'No resources available.',
  } as ToolSet[string]

  toolSet[`${prefix}__read_resource`] = {
    description: `Read a resource from ${config.name}. Use list_resources first to discover available URIs. Available: ${resources.slice(0, 5).map((r) => r.uri).join(', ')}${resources.length > 5 ? '...' : ''}`,
    inputSchema: jsonSchema<Record<string, unknown>>({
      type: 'object' as const,
      properties: {
        uri: { type: 'string' as const, description: 'Resource URI to read' },
      },
      required: ['uri'],
    }),
    execute: async (args: Record<string, unknown>) => {
      try {
        const result = await readMcpResource(config, args.uri as string)
        return result.text
      } catch (error) {
        return `[Resource error] ${error instanceof Error ? error.message : 'Failed to read resource'}`
      }
    },
  } as ToolSet[string]

  return toolSet
}

/**
 * Resolve MCP tools for a workspace.
 *
 * Connects to each enabled MCP server, lists its tools and resources,
 * and returns a combined ToolSet ready for Vercel AI SDK `streamText()`.
 *
 * Resources are exposed as synthetic tools so the AI can selectively
 * read them on demand rather than bloating every request.
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
      const [tools, resources] = await Promise.allSettled([
        listMcpServerTools(config),
        listMcpServerResources(config).catch(() => [] as McpResourceDefinition[]),
      ])
      return {
        config,
        tools: tools.status === 'fulfilled' ? tools.value : [],
        resources: resources.status === 'fulfilled' ? resources.value : [],
      }
    }),
  )

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { config, tools, resources } = result.value

    // Add native tools
    const toolSubset = buildToolSet(config, tools)
    for (const [name, t] of Object.entries(toolSubset)) {
      if (totalTools >= MAX_MCP_TOOLS_PER_REQUEST) break
      merged[name] = t
      totalTools++
    }

    // Add resource-browsing tools
    if (resources.length > 0 && totalTools < MAX_MCP_TOOLS_PER_REQUEST) {
      const resourceSubset = buildResourceToolSet(config, resources)
      for (const [name, t] of Object.entries(resourceSubset)) {
        if (totalTools >= MAX_MCP_TOOLS_PER_REQUEST) break
        merged[name] = t
        totalTools++
      }
    }
  }

  return totalTools > 0 ? merged : undefined
}
