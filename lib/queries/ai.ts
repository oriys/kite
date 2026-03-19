import { and, desc, eq, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

import { db } from '../db'
import { type AiProviderConfigListItem, getAiProviderLabel } from '../ai'
import { aiProviderConfigs, aiWorkspaceSettings } from '../schema'

type AiProviderConfigRow = typeof aiProviderConfigs.$inferSelect

function formatApiKeyHint(apiKey: string) {
  const trimmed = apiKey.trim()
  if (!trimmed) return null

  const suffix = trimmed.slice(-4)
  return suffix ? `••••${suffix}` : 'Saved'
}

export function serializeAiProviderConfig(
  row: AiProviderConfigRow,
): AiProviderConfigListItem {
  return {
    id: row.id,
    name: row.name,
    providerType: row.providerType,
    providerLabel: getAiProviderLabel(row.providerType),
    baseUrl: row.baseUrl ?? '',
    defaultModelId: row.defaultModelId ?? '',
    enabled: row.enabled,
    hasApiKey: Boolean(row.apiKey.trim()),
    apiKeyHint: formatApiKeyHint(row.apiKey),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createAiProviderConfig(
  workspaceId: string,
  input: {
    name: string
    providerType: (typeof aiProviderConfigs.$inferInsert)['providerType']
    baseUrl?: string | null
    apiKey: string
    defaultModelId?: string | null
    enabled?: boolean
  },
) {
  const [provider] = await db
    .insert(aiProviderConfigs)
    .values({
      workspaceId,
      name: input.name,
      providerType: input.providerType,
      baseUrl: input.baseUrl ?? null,
      apiKey: input.apiKey,
      defaultModelId: input.defaultModelId ?? null,
      enabled: input.enabled ?? true,
    })
    .returning()

  return provider
}

export async function listAiProviderConfigs(workspaceId: string) {
  return db.query.aiProviderConfigs.findMany({
    where: and(
      eq(aiProviderConfigs.workspaceId, workspaceId),
      isNull(aiProviderConfigs.deletedAt),
    ),
    orderBy: [desc(aiProviderConfigs.createdAt)],
    limit: 100,
  })
}

export async function listAiProviderConfigsForClient(workspaceId: string) {
  const providers = await db
    .select({
      id: aiProviderConfigs.id,
      name: aiProviderConfigs.name,
      providerType: aiProviderConfigs.providerType,
      baseUrl: aiProviderConfigs.baseUrl,
      defaultModelId: aiProviderConfigs.defaultModelId,
      enabled: aiProviderConfigs.enabled,
      createdAt: aiProviderConfigs.createdAt,
      updatedAt: aiProviderConfigs.updatedAt,
      apiKeySuffix: sql<string | null>`nullif(right(${aiProviderConfigs.apiKey}, 4), '')`,
    })
    .from(aiProviderConfigs)
    .where(
      and(
        eq(aiProviderConfigs.workspaceId, workspaceId),
        isNull(aiProviderConfigs.deletedAt),
      ),
    )
    .orderBy(desc(aiProviderConfigs.createdAt))

  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    providerType: provider.providerType,
    providerLabel: getAiProviderLabel(provider.providerType),
    baseUrl: provider.baseUrl ?? '',
    defaultModelId: provider.defaultModelId ?? '',
    enabled: provider.enabled,
    hasApiKey: Boolean(provider.apiKeySuffix),
    apiKeyHint: provider.apiKeySuffix ? `••••${provider.apiKeySuffix}` : null,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
  }))
}

export async function getAiProviderConfig(id: string, workspaceId: string) {
  return (
    (await db
      .select({
        id: aiProviderConfigs.id,
        workspaceId: aiProviderConfigs.workspaceId,
      })
      .from(aiProviderConfigs)
      .where(and(eq(aiProviderConfigs.id, id), eq(aiProviderConfigs.workspaceId, workspaceId), isNull(aiProviderConfigs.deletedAt)))
      .limit(1)
      .then(([provider]) => provider)) ?? null
  )
}

export async function updateAiProviderConfig(
  id: string,
  workspaceId: string,
  data: Partial<{
    name: string
    providerType: (typeof aiProviderConfigs.$inferInsert)['providerType']
    baseUrl: string | null
    apiKey: string
    defaultModelId: string | null
    enabled: boolean
  }>,
) {
  const [provider] = await db
    .update(aiProviderConfigs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(aiProviderConfigs.id, id), eq(aiProviderConfigs.workspaceId, workspaceId), isNull(aiProviderConfigs.deletedAt)))
    .returning()

  return provider ?? null
}

export async function deleteAiProviderConfig(id: string, workspaceId: string) {
  await db
    .update(aiProviderConfigs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(aiProviderConfigs.id, id), eq(aiProviderConfigs.workspaceId, workspaceId), isNull(aiProviderConfigs.deletedAt)))
}

export async function getAiWorkspaceSettings(workspaceId: string) {
  return (
    (await db.query.aiWorkspaceSettings.findFirst({
      where: eq(aiWorkspaceSettings.workspaceId, workspaceId),
    })) ?? null
  )
}

export async function upsertAiWorkspaceModelSettings(
  workspaceId: string,
  input: {
    defaultModelId: string | null
    enabledModelIds: string[]
    rerankerModelId?: string | null
  },
) {
  const now = new Date()

  const [settings] = await db
    .insert(aiWorkspaceSettings)
    .values({
      workspaceId,
      defaultModelId: input.defaultModelId,
      enabledModelIds: input.enabledModelIds,
      promptSettings: {},
      rerankerModelId: input.rerankerModelId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiWorkspaceSettings.workspaceId,
      set: {
        defaultModelId: input.defaultModelId,
        enabledModelIds: input.enabledModelIds,
        rerankerModelId: input.rerankerModelId ?? null,
        updatedAt: now,
      },
    })
    .returning()

  return settings
}

export async function upsertAiWorkspaceRagEnabled(
  workspaceId: string,
  ragEnabled: boolean,
) {
  const now = new Date()

  const [settings] = await db
    .insert(aiWorkspaceSettings)
    .values({
      workspaceId,
      enabledModelIds: [],
      promptSettings: {},
      ragEnabled,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiWorkspaceSettings.workspaceId,
      set: {
        ragEnabled,
        updatedAt: now,
      },
    })
    .returning()

  return settings
}

export async function upsertAiWorkspacePromptSettings(
  workspaceId: string,
  promptSettings: unknown,
) {
  const now = new Date()
  const normalizedPromptSettings =
    promptSettings && typeof promptSettings === 'object'
      ? (promptSettings as Record<string, unknown>)
      : {}

  const [settings] = await db
    .insert(aiWorkspaceSettings)
    .values({
      workspaceId,
      enabledModelIds: [],
      promptSettings: normalizedPromptSettings,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: aiWorkspaceSettings.workspaceId,
      set: {
        promptSettings: normalizedPromptSettings,
        updatedAt: now,
      },
    })
    .returning()

  return settings
}
