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

type OpenAIContentPart = {
  type?: string
  text?: string
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenAIContentPart[]
    }
  }>
  error?: {
    message?: string
  }
}

type OpenAIChatCompletionStreamResponse = {
  choices?: Array<{
    delta?: {
      content?: string | OpenAIContentPart[]
    }
  }>
  error?: {
    message?: string
  }
}

type AnthropicModelsResponse = {
  data?: unknown[]
  error?: {
    message?: string
  }
}

type AnthropicMessagesResponse = {
  content?: Array<{
    type?: string
    text?: string
  }>
  error?: {
    message?: string
  }
}

type AnthropicMessagesStreamResponse = {
  type?: string
  delta?: {
    text?: string
  }
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

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
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

function extractOpenAiCompletionText(payload: OpenAIChatCompletionResponse | null) {
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === 'text' || !part.type ? part.text ?? '' : ''))
      .join('')
      .trim()
  }

  return ''
}

function extractOpenAiStreamText(
  payload: OpenAIChatCompletionStreamResponse | null,
) {
  const content = payload?.choices?.[0]?.delta?.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === 'text' || !part.type ? part.text ?? '' : ''))
      .join('')
  }

  return ''
}

function extractAnthropicCompletionText(
  payload: AnthropicMessagesResponse | null,
) {
  return (payload?.content ?? [])
    .map((part) => (part.type === 'text' || !part.type ? part.text ?? '' : ''))
    .join('')
    .trim()
}

function extractAnthropicStreamText(
  payload: AnthropicMessagesStreamResponse | null,
) {
  return payload?.delta?.text ?? ''
}

function extractGeminiCompletionText(
  payload: GeminiGenerateContentResponse | null,
) {
  return (payload?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim()
}

function extractGeminiStreamText(
  payload: GeminiGenerateContentResponse | null,
) {
  return (payload?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
}

function parseSseEvent(rawEvent: string) {
  const eventLines = rawEvent
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)

  let eventName = ''
  const dataLines: string[] = []

  for (const line of eventLines) {
    if (line.startsWith(':')) {
      continue
    }

    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim()
      continue
    }

    if (line.startsWith('data:')) {
      const value = line.slice('data:'.length)
      dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
    }
  }

  return {
    eventName,
    data: dataLines.join('\n'),
  }
}

function createSseTextStream(
  upstream: Response,
  extractText: (payload: unknown, eventName: string) => string,
) {
  if (!upstream.body) {
    throw new AiCompletionError('The AI provider did not open a readable stream.', 502)
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = ''

      const flushEvent = (rawEvent: string) => {
        const normalized = rawEvent.trim()
        if (!normalized) {
          return
        }

        const { eventName, data } = parseSseEvent(rawEvent)
        if (!data || data === '[DONE]') {
          return
        }

        const payload = JSON.parse(data) as unknown
        const text = extractText(payload, eventName)
        if (text) {
          controller.enqueue(encoder.encode(text))
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          buffer += decoder.decode(value ?? new Uint8Array(), {
            stream: !done,
          })
          buffer = buffer.replace(/\r\n/g, '\n')

          let boundaryIndex = buffer.indexOf('\n\n')
          while (boundaryIndex !== -1) {
            const rawEvent = buffer.slice(0, boundaryIndex)
            buffer = buffer.slice(boundaryIndex + 2)
            flushEvent(rawEvent)
            boundaryIndex = buffer.indexOf('\n\n')
          }

          if (done) {
            const rest = decoder.decode()
            if (rest) {
              buffer += rest
            }
            break
          }
        }

        flushEvent(buffer)
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
    async cancel(reason) {
      await reader.cancel(reason)
    },
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

async function requestOpenAiCompletion(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}) {
  const upstream = await fetch(`${input.provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.provider.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature ?? 0.2,
      messages: [
        {
          role: 'system',
          content: input.systemPrompt,
        },
        {
          role: 'user',
          content: input.userPrompt,
        },
      ],
    }),
    cache: 'no-store',
  })

  const payload = (await upstream.json().catch(() => null)) as
    | OpenAIChatCompletionResponse
    | null

  if (!upstream.ok) {
    throw new AiCompletionError(
      getProviderErrorMessage(payload) ||
        'The AI provider request failed. Check the provider URL, model, and API key.',
      502,
    )
  }

  const completion = extractOpenAiCompletionText(payload)
  if (!completion) {
    throw new AiCompletionError('The AI provider returned an empty response.', 502)
  }

  return completion
}

async function requestOpenAiCompletionStream(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}) {
  const upstream = await fetch(`${input.provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.provider.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature ?? 0.2,
      stream: true,
      messages: [
        {
          role: 'system',
          content: input.systemPrompt,
        },
        {
          role: 'user',
          content: input.userPrompt,
        },
      ],
    }),
    cache: 'no-store',
  })

  if (!upstream.ok) {
    const payload = (await upstream.json().catch(() => null)) as
      | OpenAIChatCompletionResponse
      | null

    throw new AiCompletionError(
      getProviderErrorMessage(payload) ||
        'The AI provider request failed. Check the provider URL, model, and API key.',
      502,
    )
  }

  return createSseTextStream(upstream, (payload) =>
    extractOpenAiStreamText(payload as OpenAIChatCompletionStreamResponse | null),
  )
}

async function requestAnthropicCompletion(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}) {
  const upstream = await fetch(`${input.provider.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': input.provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 2_048,
      temperature: input.temperature ?? 0.2,
      system: input.systemPrompt,
      messages: [
        {
          role: 'user',
          content: input.userPrompt,
        },
      ],
    }),
    cache: 'no-store',
  })

  const payload = (await upstream.json().catch(() => null)) as
    | AnthropicMessagesResponse
    | null

  if (!upstream.ok) {
    throw new AiCompletionError(
      getProviderErrorMessage(payload) ||
        'Anthropic could not complete this request.',
      502,
    )
  }

  const completion = extractAnthropicCompletionText(payload)
  if (!completion) {
    throw new AiCompletionError('Anthropic returned an empty response.', 502)
  }

  return completion
}

async function requestAnthropicCompletionStream(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}) {
  const upstream = await fetch(`${input.provider.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': input.provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 2_048,
      temperature: input.temperature ?? 0.2,
      system: input.systemPrompt,
      stream: true,
      messages: [
        {
          role: 'user',
          content: input.userPrompt,
        },
      ],
    }),
    cache: 'no-store',
  })

  if (!upstream.ok) {
    const payload = (await upstream.json().catch(() => null)) as
      | AnthropicMessagesResponse
      | null

    throw new AiCompletionError(
      getProviderErrorMessage(payload) ||
        'Anthropic could not complete this request.',
      502,
    )
  }

  return createSseTextStream(upstream, (payload, eventName) => {
    if (eventName && eventName !== 'content_block_delta') {
      return ''
    }

    return extractAnthropicStreamText(
      payload as AnthropicMessagesStreamResponse | null,
    )
  })
}

async function requestGeminiCompletion(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}) {
  const upstream = await fetch(
    `${input.provider.baseUrl}/${input.model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': input.provider.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          role: 'system',
          parts: [{ text: input.systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: input.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: input.temperature ?? 0.2,
          maxOutputTokens: 2_048,
        },
      }),
      cache: 'no-store',
    },
  )

  const payload = (await upstream.json().catch(() => null)) as
    | GeminiGenerateContentResponse
    | null

  if (!upstream.ok) {
    throw new AiCompletionError(
      getProviderErrorMessage(payload) || 'Gemini could not complete this request.',
      502,
    )
  }

  const completion = extractGeminiCompletionText(payload)
  if (!completion) {
    throw new AiCompletionError('Gemini returned an empty response.', 502)
  }

  return completion
}

async function requestGeminiCompletionStream(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}) {
  const upstream = await fetch(
    `${input.provider.baseUrl}/${input.model}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': input.provider.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          role: 'system',
          parts: [{ text: input.systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: input.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: input.temperature ?? 0.2,
          maxOutputTokens: 2_048,
        },
      }),
      cache: 'no-store',
    },
  )

  if (!upstream.ok) {
    const payload = (await upstream.json().catch(() => null)) as
      | GeminiGenerateContentResponse
      | null

    throw new AiCompletionError(
      getProviderErrorMessage(payload) || 'Gemini could not complete this request.',
      502,
    )
  }

  return createSseTextStream(upstream, (payload) =>
    extractGeminiStreamText(payload as GeminiGenerateContentResponse | null),
  )
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

  let result = ''

  switch (input.provider.providerType) {
    case 'openai_compatible':
      result = await requestOpenAiCompletion(input)
      break
    case 'anthropic':
      result = await requestAnthropicCompletion(input)
      break
    case 'gemini':
      result = await requestGeminiCompletion(input)
      break
    default:
      throw new AiCompletionError('Unsupported AI provider type.', 400)
  }

  return {
    result,
    model: createAiModelRef(input.provider.id, input.model),
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

  let stream: ReadableStream<Uint8Array>

  switch (input.provider.providerType) {
    case 'openai_compatible':
      stream = await requestOpenAiCompletionStream(input)
      break
    case 'anthropic':
      stream = await requestAnthropicCompletionStream(input)
      break
    case 'gemini':
      stream = await requestGeminiCompletionStream(input)
      break
    default:
      throw new AiCompletionError('Unsupported AI provider type.', 400)
  }

  return {
    stream,
    model: createAiModelRef(input.provider.id, input.model),
  }
}
