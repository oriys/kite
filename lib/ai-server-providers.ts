import {
  AI_PROVIDER_NAME,
  DEFAULT_AIHUBMIX_BASE_URL,
  DEFAULT_AIHUBMIX_MODEL,
  type AiCatalogModel,
} from '@/lib/ai'
import { listAiProviderConfigs } from '@/lib/queries/ai'
import {
  AiCompletionError,
  type AnthropicModelsResponse,
  type GeminiModelsResponse,
  type ResolvedAiProviderConfig,
} from './ai-server-types'
import {
  getProviderErrorMessage,
  normalizeAnthropicModel,
  normalizeBaseUrl,
  normalizeGeminiModel,
  normalizeOpenAiModel,
} from './ai-server-helpers'

function getEnvFallbackProvider(): ResolvedAiProviderConfig | null {
  const apiKey =
    process.env.AIHUBMIX_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()

  if (!apiKey) {
    return null
  }

  return {
    id: 'env-default',
    name: AI_PROVIDER_NAME,
    providerType: 'openai_compatible',
    baseUrl: normalizeBaseUrl(
      'openai_compatible',
      process.env.AIHUBMIX_BASE_URL?.trim() ||
        process.env.OPENAI_BASE_URL?.trim() ||
        DEFAULT_AIHUBMIX_BASE_URL,
    ),
    apiKey,
    defaultModelId:
      process.env.AIHUBMIX_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      DEFAULT_AIHUBMIX_MODEL,
    enabled: true,
    source: 'env',
  }
}

export async function resolveWorkspaceAiProviders(workspaceId: string) {
  const dbProviders = await listAiProviderConfigs(workspaceId)

  if (dbProviders.length > 0) {
    return dbProviders.map((provider) => ({
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      baseUrl: normalizeBaseUrl(provider.providerType, provider.baseUrl ?? ''),
      apiKey: provider.apiKey.trim(),
      defaultModelId: provider.defaultModelId?.trim() ?? '',
      enabled: provider.enabled,
      source: 'database' as const,
    }))
  }

  const envProvider = getEnvFallbackProvider()
  return envProvider ? [envProvider] : []
}

async function listOpenAiModels(provider: ResolvedAiProviderConfig) {
  const upstream = await fetch(`${provider.baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
    },
    cache: 'no-store',
  })

  const payload = (await upstream.json().catch(() => null)) as
    | { data?: unknown[]; error?: { message?: string } }
    | null

  if (!upstream.ok) {
    throw new AiCompletionError(
      getProviderErrorMessage(payload) ||
        'The OpenAI-compatible provider did not return a model catalog.',
      502,
    )
  }

  return Array.from(
    new Map(
      (Array.isArray(payload?.data) ? payload.data : [])
        .map((entry) => normalizeOpenAiModel(entry, provider))
        .filter((entry): entry is AiCatalogModel => entry !== null)
        .map((entry) => [entry.id, entry]),
    ).values(),
  )
}

async function listAnthropicModels(provider: ResolvedAiProviderConfig) {
  const upstream = await fetch(`${provider.baseUrl}/models`, {
    headers: {
      'content-type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    cache: 'no-store',
  })

  const payload = (await upstream.json().catch(() => null)) as
    | AnthropicModelsResponse
    | null

  if (!upstream.ok) {
    throw new AiCompletionError(
      getProviderErrorMessage(payload) ||
        'Anthropic did not return a model catalog.',
      502,
    )
  }

  return Array.from(
    new Map(
      (Array.isArray(payload?.data) ? payload.data : [])
        .map((entry) => normalizeAnthropicModel(entry, provider))
        .filter((entry): entry is AiCatalogModel => entry !== null)
        .map((entry) => [entry.id, entry]),
    ).values(),
  )
}

async function listGeminiModels(provider: ResolvedAiProviderConfig) {
  const upstream = await fetch(`${provider.baseUrl}/models`, {
    headers: {
      'x-goog-api-key': provider.apiKey,
    },
    cache: 'no-store',
  })

  const payload = (await upstream.json().catch(() => null)) as
    | GeminiModelsResponse
    | null

  if (!upstream.ok) {
    throw new AiCompletionError(
      getProviderErrorMessage(payload) || 'Gemini did not return a model catalog.',
      502,
    )
  }

  return Array.from(
    new Map(
      (Array.isArray(payload?.models) ? payload.models : [])
        .map((entry) => normalizeGeminiModel(entry, provider))
        .filter((entry): entry is AiCatalogModel => entry !== null)
        .map((entry) => [entry.id, entry]),
    ).values(),
  )
}

export async function listProviderModels(provider: ResolvedAiProviderConfig) {
  if (!provider.enabled) {
    return []
  }

  if (!provider.apiKey) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  switch (provider.providerType) {
    case 'openai_compatible':
      return listOpenAiModels(provider)
    case 'anthropic':
      return listAnthropicModels(provider)
    case 'gemini':
      return listGeminiModels(provider)
    default:
      return []
  }
}
