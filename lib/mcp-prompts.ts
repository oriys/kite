import { listEnabledMcpServerConfigs } from '@/lib/queries/mcp'
import {
  listMcpServerPrompts,
  type McpPromptDefinition,
} from '@/lib/mcp-client'

export interface WorkspaceMcpPrompt {
  serverId: string
  serverName: string
  name: string
  description: string
  arguments: McpPromptDefinition['arguments']
}

/**
 * Aggregate prompts from all enabled MCP servers in a workspace.
 */
export async function resolveWorkspaceMcpPrompts(
  workspaceId: string,
): Promise<WorkspaceMcpPrompt[]> {
  const configs = await listEnabledMcpServerConfigs(workspaceId)
  if (configs.length === 0) return []

  const results = await Promise.allSettled(
    configs.map(async (config) => {
      const prompts = await listMcpServerPrompts(config)
      return { config, prompts }
    }),
  )

  const all: WorkspaceMcpPrompt[] = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { config, prompts } = result.value
    for (const prompt of prompts) {
      all.push({
        serverId: config.id,
        serverName: config.name,
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      })
    }
  }

  return all
}
