import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  MAX_AI_MODEL_ID_LENGTH,
  isEmbeddingCapableAiProviderType,
} from '@/lib/ai'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import {
  getAiWorkspaceSettings,
  upsertAiWorkspaceModelSettings,
} from '@/lib/queries/ai'
import { resolveWorkspaceAiProviders } from '@/lib/ai-server'

function normalizeModelId(value: unknown) {
  return typeof value === 'string'
    ? value.trim().slice(0, MAX_AI_MODEL_ID_LENGTH)
    : ''
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): value is Record<string, unknown> & { [K in typeof key]: unknown } {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function normalizeEnabledModelIds(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  return Array.from(
    new Set(
      value.reduce<string[]>((acc, entry) => {
        const normalized = normalizeModelId(entry)

        if (normalized) {
          acc.push(normalized)
        }

        return acc
      }, []),
    ),
  )
}

function readStoredEnabledModelIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

export async function PUT(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return badRequest('Invalid JSON')
  }
  const input = body as Record<string, unknown>

  const [currentSettings, providers] = await Promise.all([
    getAiWorkspaceSettings(result.ctx.workspaceId),
    resolveWorkspaceAiProviders(result.ctx.workspaceId),
  ])

  const storedEnabledModelIds = readStoredEnabledModelIds(
    currentSettings?.enabledModelIds,
  )
  const nextDefaultModelId = hasOwn(input, 'defaultModelId')
    ? normalizeModelId(input.defaultModelId)
    : currentSettings?.defaultModelId?.trim() ?? ''
  const nextRerankerModelId = hasOwn(input, 'rerankerModelId')
    ? normalizeModelId(input.rerankerModelId)
    : currentSettings?.rerankerModelId?.trim() ?? ''
  const enabledModelIds = hasOwn(input, 'enabledModelIds')
    ? normalizeEnabledModelIds(input.enabledModelIds)
    : storedEnabledModelIds

  if (!enabledModelIds) {
    return badRequest('enabledModelIds must be an array')
  }

  const nextEmbeddingProviderId = hasOwn(input, 'embeddingProviderId')
    ? normalizeModelId(input.embeddingProviderId)
    : currentSettings?.embeddingProviderId?.trim() ?? ''
  const nextEmbeddingModelId = hasOwn(input, 'embeddingModelId')
    ? normalizeModelId(input.embeddingModelId)
    : currentSettings?.embeddingModelId?.trim() ?? ''

  if (nextEmbeddingProviderId) {
    const provider = providers.find(
      (candidate) => candidate.id === nextEmbeddingProviderId && candidate.enabled,
    )

    if (!provider) {
      return badRequest('Selected embedding provider is not available.')
    }

    if (!isEmbeddingCapableAiProviderType(provider.providerType)) {
      return badRequest('Selected provider does not support embeddings.')
    }
  }

  if (nextDefaultModelId && !enabledModelIds.includes(nextDefaultModelId)) {
    enabledModelIds.unshift(nextDefaultModelId)
  }

  await upsertAiWorkspaceModelSettings(result.ctx.workspaceId, {
    defaultModelId: nextDefaultModelId || null,
    enabledModelIds,
    embeddingProviderId: nextEmbeddingProviderId || null,
    embeddingModelId: nextEmbeddingModelId || null,
    rerankerModelId: nextRerankerModelId || null,
  })

  return NextResponse.json({
    defaultModelId: nextDefaultModelId,
    enabledModelIds,
    embeddingProviderId: nextEmbeddingProviderId,
    embeddingModelId: nextEmbeddingModelId,
    rerankerModelId: nextRerankerModelId,
  })
}
