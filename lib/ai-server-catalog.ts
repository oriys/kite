import {
  createAiModelRef,
  getAiProviderLabel,
  parseAiModelRef,
  type AiProviderSummary,
} from '@/lib/ai'
import type { AiCatalogLoadResult, ResolvedAiProviderConfig } from './ai-server-types'
import { createFallbackModel } from './ai-server-helpers'
import { listProviderModels, resolveWorkspaceAiProviders } from './ai-server-providers'

export async function loadWorkspaceAiCatalog(workspaceId: string) {
  const providers = await resolveWorkspaceAiProviders(workspaceId)

  if (providers.length === 0) {
    return {
      configured: false,
      providers: [],
      models: [],
      error: 'No AI provider is configured for this workspace.',
    } satisfies AiCatalogLoadResult
  }

  const providerResults = await Promise.all(
    providers
      .filter((provider) => provider.enabled)
      .map(async (provider) => {
        try {
          const models = await listProviderModels(provider)
          return {
            provider,
            models: models.length > 0 ? models : createFallbackModel(provider) ? [createFallbackModel(provider)!] : [],
            error: undefined,
          }
        } catch (error) {
          return {
            provider,
            models: createFallbackModel(provider) ? [createFallbackModel(provider)!] : [],
            error:
              error instanceof Error
                ? error.message
                : 'Unable to reach this AI provider right now.',
          }
        }
      }),
  )

  const summaries: AiProviderSummary[] = providerResults.map(
    ({ provider, models, error }) => ({
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      providerLabel: getAiProviderLabel(provider.providerType),
      baseUrl: provider.baseUrl,
      defaultModelId: provider.defaultModelId,
      enabled: provider.enabled,
      source: provider.source,
      modelCount: models.length,
      error,
    }),
  )

  const models = Array.from(
    new Map(
      providerResults
        .flatMap((entry) => entry.models)
        .map((model) => [model.id, model]),
    ).values(),
  )

  const combinedError = providerResults
    .map((entry) => entry.error)
    .filter((value): value is string => Boolean(value))
    .join(' ')

  return {
    configured: providers.some((provider) => provider.enabled),
    providers: summaries,
    models,
    error: combinedError || undefined,
  } satisfies AiCatalogLoadResult
}

export function resolveAiModelSelection(input: {
  requestedModelId?: string | null
  defaultModelId?: string | null
  enabledModelIds?: string[]
  providers: ResolvedAiProviderConfig[]
}) {
  const candidates = [
    input.requestedModelId?.trim() ?? '',
    input.defaultModelId?.trim() ?? '',
    ...(input.enabledModelIds ?? []).map((value) => value.trim()),
    ...input.providers
      .filter((provider) => provider.enabled && provider.defaultModelId)
      .map((provider) => createAiModelRef(provider.id, provider.defaultModelId)),
  ].filter(Boolean)

  for (const candidate of candidates) {
    const parsed = parseAiModelRef(candidate)

    if (parsed) {
      const provider = input.providers.find(
        (entry) => entry.id === parsed.providerId && entry.enabled,
      )

      if (provider) {
        return {
          provider,
          modelId: parsed.modelId,
          modelRef: candidate,
        }
      }

      continue
    }

    const onlyProvider =
      input.providers.filter((provider) => provider.enabled).length === 1
        ? input.providers.find((provider) => provider.enabled) ?? null
        : null

    if (onlyProvider) {
      return {
        provider: onlyProvider,
        modelId: candidate,
        modelRef: createAiModelRef(onlyProvider.id, candidate),
      }
    }
  }

  return null
}
