import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, streamText, embedMany } from 'ai'
import type { LanguageModel, EmbeddingModel } from 'ai'

import {
  AI_PROVIDER_NAME,
  DEFAULT_AIHUBMIX_BASE_URL,
  DEFAULT_AIHUBMIX_MODEL,
  createAiModelRef,
  formatAiModelLabel,
  getAiProviderDefaultBaseUrl,
  getAiProviderLabel,
  parseAiModelRef,
  type AiCatalogModel,
  type AiProviderSummary,
  type AiProviderType,
} from '@/lib/ai'
import { listAiProviderConfigs } from '@/lib/queries/ai'

type AnthropicModelsResponse = {
  data?: unknown[]
  error?: {
    message?: string
  }
}

type GeminiModelsResponse = {
  models?: unknown[]
  error?: {
    message?: string
  }
}

export interface ResolvedAiProviderConfig {
  id: string
  name: string
  providerType: AiProviderType
  baseUrl: string
  apiKey: string
  defaultModelId: string
  enabled: boolean
  source: 'database' | 'env'
}

export interface AiCatalogLoadResult {
  configured: boolean
  providers: AiProviderSummary[]
  models: AiCatalogModel[]
  error?: string
}

export class AiCompletionError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AiCompletionError'
    this.status = status
  }
}

function normalizeBaseUrl(providerType: AiProviderType, value: string) {
  const trimmed = value.trim()
  return (trimmed || getAiProviderDefaultBaseUrl(providerType)).replace(/\/$/, '')
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const nextValue = Number(value)
    return Number.isFinite(nextValue) ? nextValue : null
  }

  return null
}

function getStringArray(...values: unknown[]) {
  return Array.from(
    new Set(
      values.flatMap((value) =>
        Array.isArray(value)
          ? value
              .map((entry) => getString(entry))
              .filter(Boolean)
          : [],
      ),
    ),
  )
}

function inferCapabilities(raw: Record<string, unknown>, id: string) {
  const haystack = [
    id,
    getString(raw.desc),
    getString(raw.description),
    getString(raw.category),
    getString(raw.display_name),
  ]
    .join(' ')
    .toLowerCase()

  const inferred = []

  if (haystack.includes('vision') || haystack.includes('multimodal')) {
    inferred.push('Vision')
  }
  if (haystack.includes('reason')) {
    inferred.push('Reasoning')
  }
  if (haystack.includes('embed')) {
    inferred.push('Embeddings')
  }
  if (haystack.includes('image')) {
    inferred.push('Images')
  }
  if (haystack.includes('audio') || haystack.includes('speech')) {
    inferred.push('Audio')
  }

  return getStringArray(raw.features, raw.types, raw.capabilities, inferred)
}

function createCatalogModel(
  provider: ResolvedAiProviderConfig,
  modelId: string,
  options?: {
    label?: string
    description?: string
    contextWindow?: number | null
    capabilities?: string[]
  },
): AiCatalogModel {
  return {
    id: createAiModelRef(provider.id, modelId),
    modelId,
    label: options?.label || formatAiModelLabel(modelId),
    provider: provider.name,
    providerId: provider.id,
    providerType: provider.providerType,
    description:
      options?.description || 'Available through the workspace AI provider.',
    contextWindow: options?.contextWindow ?? null,
    capabilities: options?.capabilities ?? [],
  }
}

function createFallbackModel(provider: ResolvedAiProviderConfig) {
  return provider.defaultModelId
    ? createCatalogModel(provider, provider.defaultModelId, {
        description: 'Configured as the provider default model.',
      })
    : null
}

function normalizeOpenAiModel(
  raw: unknown,
  provider: ResolvedAiProviderConfig,
): AiCatalogModel | null {
  if (!raw || typeof raw !== 'object') return null

  const model = raw as Record<string, unknown>
  const modelId = getString(model.id) || getString(model.model_id)
  if (!modelId) return null

  return createCatalogModel(provider, modelId, {
    label:
      getString(model.name) ||
      getString(model.display_name) ||
      formatAiModelLabel(modelId),
    description:
      getString(model.desc) ||
      getString(model.description) ||
      'Available through the workspace AI provider.',
    contextWindow:
      getNumber(model.context_window) ??
      getNumber(model.context_length) ??
      getNumber(model.max_tokens) ??
      getNumber(model.max_input_tokens) ??
      getNumber(model.max_output_tokens) ??
      null,
    capabilities: inferCapabilities(model, modelId),
  })
}

function normalizeAnthropicModel(
  raw: unknown,
  provider: ResolvedAiProviderConfig,
): AiCatalogModel | null {
  if (!raw || typeof raw !== 'object') return null

  const model = raw as Record<string, unknown>
  const modelId = getString(model.id)
  if (!modelId) return null

  return createCatalogModel(provider, modelId, {
    label: getString(model.display_name) || formatAiModelLabel(modelId),
    description: 'Available through the Anthropic Messages API.',
    capabilities: inferCapabilities(model, modelId),
  })
}

function normalizeGeminiModel(
  raw: unknown,
  provider: ResolvedAiProviderConfig,
): AiCatalogModel | null {
  if (!raw || typeof raw !== 'object') return null

  const model = raw as Record<string, unknown>
  const modelId = getString(model.name)
  if (!modelId) return null

  const supportedGenerationMethods = getStringArray(
    model.supportedGenerationMethods,
  )

  if (
    supportedGenerationMethods.length > 0 &&
    !supportedGenerationMethods.includes('generateContent')
  ) {
    return null
  }

  return createCatalogModel(provider, modelId, {
    label:
      getString(model.displayName) ||
      getString(model.display_name) ||
      formatAiModelLabel(modelId.replace(/^models\//, '')),
    description:
      getString(model.description) ||
      'Available through the Google Gemini API.',
    contextWindow:
      getNumber(model.inputTokenLimit) ??
      getNumber(model.outputTokenLimit) ??
      null,
    capabilities: getStringArray(model.supportedGenerationMethods),
  })
}


function getProviderErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const record = payload as Record<string, unknown>
  const directError = record.error

  if (typeof directError === 'string') {
    return directError
  }

  if (directError && typeof directError === 'object') {
    const nestedMessage = getString((directError as Record<string, unknown>).message)
    if (nestedMessage) return nestedMessage
  }

  const message = getString(record.message)
  return message
}

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

async function listProviderModels(provider: ResolvedAiProviderConfig) {
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

// ─── Vercel AI SDK integration ──────────────────────────────────

function normalizeGeminiModelId(modelId: string) {
  return modelId.startsWith('models/') ? modelId.slice('models/'.length) : modelId
}

export function createLanguageModel(
  provider: ResolvedAiProviderConfig,
  modelId: string,
): LanguageModel {
  switch (provider.providerType) {
    case 'openai_compatible': {
      const instance = createOpenAI({
        baseURL: provider.baseUrl,
        apiKey: provider.apiKey,
      })
      return instance(modelId)
    }
    case 'anthropic': {
      const instance = createAnthropic({
        baseURL: provider.baseUrl,
        apiKey: provider.apiKey,
      })
      return instance(modelId)
    }
    case 'gemini': {
      const instance = createGoogleGenerativeAI({
        baseURL: provider.baseUrl,
        apiKey: provider.apiKey,
      })
      return instance(normalizeGeminiModelId(modelId))
    }
    default:
      throw new AiCompletionError('Unsupported AI provider type.', 400)
  }
}

export function createEmbeddingModel(
  provider: ResolvedAiProviderConfig,
  modelId: string,
): EmbeddingModel {
  switch (provider.providerType) {
    case 'openai_compatible': {
      const instance = createOpenAI({
        baseURL: provider.baseUrl,
        apiKey: provider.apiKey,
      })
      return instance.embedding(modelId)
    }
    case 'gemini': {
      const instance = createGoogleGenerativeAI({
        baseURL: provider.baseUrl,
        apiKey: provider.apiKey,
      })
      return instance.textEmbeddingModel(normalizeGeminiModelId(modelId))
    }
    case 'anthropic':
      throw new AiCompletionError(
        'Anthropic does not support embedding models. Use an OpenAI-compatible or Gemini provider for embeddings.',
        400,
      )
    default:
      throw new AiCompletionError('Unsupported AI provider type for embeddings.', 400)
  }
}

export async function requestAiTextCompletion(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  try {
    const model = createLanguageModel(input.provider, input.model)
    const { text } = await generateText({
      model,
      system: input.systemPrompt,
      prompt: input.userPrompt,
      temperature: input.temperature ?? 0.2,
    })

    if (!text.trim()) {
      throw new AiCompletionError('The AI provider returned an empty response.', 502)
    }

    return {
      result: text.trim(),
      model: createAiModelRef(input.provider.id, input.model),
    }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    const message = error instanceof Error ? error.message : 'The AI provider request failed.'
    throw new AiCompletionError(message, 502)
  }
}

export async function requestAiTextCompletionStream(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  try {
    const model = createLanguageModel(input.provider, input.model)
    const result = streamText({
      model,
      system: input.systemPrompt,
      prompt: input.userPrompt,
      temperature: input.temperature ?? 0.2,
    })

    const encoder = new TextEncoder()
    const textStream = result.textStream
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return {
      stream,
      model: createAiModelRef(input.provider.id, input.model),
    }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    const message = error instanceof Error ? error.message : 'The AI provider request failed.'
    throw new AiCompletionError(message, 502)
  }
}

export async function requestAiEmbedding(input: {
  provider: ResolvedAiProviderConfig
  texts: string[]
  model: string
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  if (input.texts.length === 0) {
    return { embeddings: [] }
  }

  try {
    const model = createEmbeddingModel(input.provider, input.model)
    const { embeddings } = await embedMany({
      model,
      values: input.texts,
    })

    return { embeddings }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    const message = error instanceof Error ? error.message : 'The embedding request failed.'
    throw new AiCompletionError(message, 502)
  }
}

export async function requestAiChatCompletionStream(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model: string
  temperature?: number
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  try {
    const model = createLanguageModel(input.provider, input.model)
    const result = streamText({
      model,
      system: input.systemPrompt,
      messages: input.messages,
      temperature: input.temperature ?? 0.3,
    })

    const encoder = new TextEncoder()
    const textStream = result.textStream
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return {
      stream,
      model: createAiModelRef(input.provider.id, input.model),
    }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    const message = error instanceof Error ? error.message : 'The AI provider request failed.'
    throw new AiCompletionError(message, 502)
  }
}
