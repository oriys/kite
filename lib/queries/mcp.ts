import { and, desc, eq, isNull } from 'drizzle-orm'

import { getMcpTransportLabel } from '../ai'
import { db } from '../db'
import type { McpServerConfigListItem } from '../mcp-server-config'
import { mcpServerConfigs } from '../schema'

type McpServerConfigRow = typeof mcpServerConfigs.$inferSelect

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  return []
}

function asStringRecord(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>
  }
  return {}
}

export function serializeMcpServerConfig(
  row: McpServerConfigRow,
): McpServerConfigListItem {
  const args = asStringArray(row.args)
  const env = asStringRecord(row.env)
  const headers = asStringRecord(row.headers)
  return {
    id: row.id,
    name: row.name,
    transportType: row.transportType,
    transportLabel: getMcpTransportLabel(row.transportType),
    command: row.command ?? '',
    url: row.url ?? '',
    enabled: row.enabled,
    args,
    env,
    headers,
    argsCount: args.length,
    envCount: Object.keys(env).length,
    headersCount: Object.keys(headers).length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createMcpServerConfig(
  workspaceId: string,
  input: {
    name: string
    transportType: McpServerConfigRow['transportType']
    command?: string | null
    args?: string[] | null
    env?: Record<string, string> | null
    url?: string | null
    headers?: Record<string, string> | null
    enabled?: boolean
  },
) {
  const [config] = await db
    .insert(mcpServerConfigs)
    .values({
      workspaceId,
      name: input.name,
      transportType: input.transportType,
      command: input.command ?? null,
      args: input.args ?? [],
      env: input.env ?? {},
      url: input.url ?? null,
      headers: input.headers ?? {},
      enabled: input.enabled ?? true,
    })
    .returning()

  return config
}

export async function listMcpServerConfigs(workspaceId: string) {
  return db.query.mcpServerConfigs.findMany({
    where: and(
      eq(mcpServerConfigs.workspaceId, workspaceId),
      isNull(mcpServerConfigs.deletedAt),
    ),
    orderBy: [desc(mcpServerConfigs.createdAt)],
  })
}

export async function getMcpServerConfig(id: string, workspaceId: string) {
  return db.query.mcpServerConfigs.findFirst({
    where: and(
      eq(mcpServerConfigs.id, id),
      eq(mcpServerConfigs.workspaceId, workspaceId),
      isNull(mcpServerConfigs.deletedAt),
    ),
  }) ?? null
}

export async function updateMcpServerConfig(
  id: string,
  workspaceId: string,
  data: Partial<{
    name: string
    transportType: McpServerConfigRow['transportType']
    command: string | null
    args: string[] | null
    env: Record<string, string> | null
    url: string | null
    headers: Record<string, string> | null
    enabled: boolean
  }>,
) {
  const [config] = await db
    .update(mcpServerConfigs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mcpServerConfigs.id, id),
        eq(mcpServerConfigs.workspaceId, workspaceId),
        isNull(mcpServerConfigs.deletedAt),
      ),
    )
    .returning()

  return config ?? null
}

export async function deleteMcpServerConfig(id: string, workspaceId: string) {
  await db
    .update(mcpServerConfigs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(mcpServerConfigs.id, id),
        eq(mcpServerConfigs.workspaceId, workspaceId),
        isNull(mcpServerConfigs.deletedAt),
      ),
    )
}

export async function listEnabledMcpServerConfigs(workspaceId: string) {
  return db.query.mcpServerConfigs.findMany({
    where: and(
      eq(mcpServerConfigs.workspaceId, workspaceId),
      eq(mcpServerConfigs.enabled, true),
      isNull(mcpServerConfigs.deletedAt),
    ),
    orderBy: [desc(mcpServerConfigs.createdAt)],
  })
}
