import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import {
  createGoogleGenerativeAI,
  type GoogleEmbeddingModelOptions,
} from '@ai-sdk/google'
import { generateText, streamText, embedMany, type ToolSet } from 'ai'
import type { LanguageModel, EmbeddingModel } from 'ai'

import {
  createAiModelRef,
  HARDCODED_EMBEDDING_BASE_URL,
  HARDCODED_EMBEDDING_MODEL,
  HARDCODED_EMBEDDING_PROVIDER_ID,
  HARDCODED_EMBEDDING_PROVIDER_NAME,
} from '@/lib/ai'
import {
  collectMcpToolNamesFromSteps,
  createChatMessageAttribution,
} from '@/lib/ai-chat-shared'
import {
  TEMPERATURE_CHAT,
  TEMPERATURE_COMPLETION,
  AI_IDEMPOTENT_REQUEST_MAX_ATTEMPTS,
  AI_IDEMPOTENT_RETRY_DELAY_MS,
  AI_PROVIDER_REQUEST_TIMEOUT_MS,
  AI_RERANK_REQUEST_BATCH_SIZE,
  AI_RERANK_REQUEST_TIMEOUT_MS,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_REQUEST_BATCH_SIZE,
  EMBEDDING_VECTOR_DIMENSION,
} from '@/lib/ai-config'
import {
  AiCompletionError,
  type OpenAiCompatibleRerankResponse,
  type ResolvedAiProviderConfig,
} from './ai-server-types'
import { getNumber } from './ai-server-helpers'
import {
  createTimeoutAbortSignal,
  formatAiProviderErrorMessage,
  isRetryableAiProviderError,
  retryOnRetryableAiError,
} from './ai-error-utils'

function normalizeGeminiModelId(modelId: string) {
  return modelId.startsWith('models/') ? modelId.slice('models/'.length) : modelId
}

function getEmbeddingProviderOptions(provider: ResolvedAiProviderConfig) {
  if (provider.providerType !== 'gemini') return undefined

  return {
    google: {
      outputDimensionality: EMBEDDING_VECTOR_DIMENSION,
    } satisfies GoogleEmbeddingModelOptions,
  }
}

async function requestEmbeddingBatch(input: {
  model: EmbeddingModel
  texts: string[]
  abortSignal?: AbortSignal
  providerOptions?: ReturnType<typeof getEmbeddingProviderOptions>
}) {
  const abortSignal = createTimeoutAbortSignal(
    AI_PROVIDER_REQUEST_TIMEOUT_MS,
    input.abortSignal,
  )
  const { embeddings } = await embedMany({
    model: input.model,
    values: input.texts,
    abortSignal,
    ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
  })

  return embeddings
}

async function requestEmbeddingBatchWithAdaptiveSplitting(input: {
  model: EmbeddingModel
  texts: string[]
  abortSignal?: AbortSignal
  providerOptions?: ReturnType<typeof getEmbeddingProviderOptions>
}): Promise<number[][]> {
  try {
    return await retryOnRetryableAiError(
      () => requestEmbeddingBatch(input),
      {
        maxAttempts: AI_IDEMPOTENT_REQUEST_MAX_ATTEMPTS,
        delayMs: AI_IDEMPOTENT_RETRY_DELAY_MS,
      },
    )
  } catch (error) {
    if (input.texts.length <= 1 || !isRetryableAiProviderError(error)) {
      throw error
    }

    const midpoint = Math.ceil(input.texts.length / 2)
    const leftEmbeddings = await requestEmbeddingBatchWithAdaptiveSplitting({
      ...input,
      texts: input.texts.slice(0, midpoint),
    })
    const rightEmbeddings = await requestEmbeddingBatchWithAdaptiveSplitting({
      ...input,
      texts: input.texts.slice(midpoint),
    })

    return [...leftEmbeddings, ...rightEmbeddings]
  }
}

interface RerankCandidate {
  index: number
  document: string
}

async function requestRerankBatch(input: {
  endpoint: string
  provider: ResolvedAiProviderConfig
  model: string
  query: string
  candidates: RerankCandidate[]
  abortSignal?: AbortSignal
}) {
  const abortSignal = createTimeoutAbortSignal(
    AI_RERANK_REQUEST_TIMEOUT_MS,
    input.abortSignal,
  )
  const response = await fetch(input.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${input.provider.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      query: input.query,
      documents: input.candidates.map((candidate) => candidate.document),
      top_n: input.candidates.length,
      return_documents: false,
    }),
    signal: abortSignal,
  })

  const payload = (await response.json().catch(() => null)) as OpenAiCompatibleRerankResponse | null
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `The reranker request failed with status ${response.status}.`
    throw new AiCompletionError(message, response.status)
  }

  const rows = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.data)
      ? payload.data
      : []

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const record = row as Record<string, unknown>
      const localIndex = getNumber(record.index)
      const relevanceScore =
        getNumber(record.relevance_score) ??
        getNumber(record.score) ??
        getNumber(record.relevanceScore)

      if (localIndex === null || relevanceScore === null) return null
      const candidate = input.candidates[localIndex]
      if (!candidate) return null

      return {
        index: candidate.index,
        relevanceScore,
      }
    })
    .filter(
      (result): result is { index: number; relevanceScore: number } => result !== null,
    )
}

async function requestRerankBatchWithAdaptiveSplitting(input: {
  endpoint: string
  provider: ResolvedAiProviderConfig
  model: string
  query: string
  candidates: RerankCandidate[]
  abortSignal?: AbortSignal
}): Promise<Array<{ index: number; relevanceScore: number }>> {
  try {
    return await retryOnRetryableAiError(
      () => requestRerankBatch(input),
      {
        maxAttempts: AI_IDEMPOTENT_REQUEST_MAX_ATTEMPTS,
        delayMs: AI_IDEMPOTENT_RETRY_DELAY_MS,
      },
    )
  } catch (error) {
    if (input.candidates.length <= 1 || !isRetryableAiProviderError(error)) {
      throw error
    }

    const midpoint = Math.ceil(input.candidates.length / 2)
    const leftResults = await requestRerankBatchWithAdaptiveSplitting({
      ...input,
      candidates: input.candidates.slice(0, midpoint),
    })
    const rightResults = await requestRerankBatchWithAdaptiveSplitting({
      ...input,
      candidates: input.candidates.slice(midpoint),
    })

    return [...leftResults, ...rightResults]
  }
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
      return instance.chat(modelId)
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
  abortSignal?: AbortSignal
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  try {
    const abortSignal = createTimeoutAbortSignal(
      AI_PROVIDER_REQUEST_TIMEOUT_MS,
      input.abortSignal,
    )
    const model = createLanguageModel(input.provider, input.model)
    const { text } = await generateText({
      model,
      system: input.systemPrompt,
      prompt: input.userPrompt,
      temperature: input.temperature ?? TEMPERATURE_COMPLETION,
      abortSignal,
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
    console.error('AI provider error:', error)
    throw new AiCompletionError(
      formatAiProviderErrorMessage(error, {
        operation: 'AI text generation request',
        service: 'AI text generation service',
      }),
      502,
    )
  }
}

export async function requestAiTextCompletionStream(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
  abortSignal?: AbortSignal
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  try {
    const abortSignal = createTimeoutAbortSignal(
      AI_PROVIDER_REQUEST_TIMEOUT_MS,
      input.abortSignal,
    )
    const model = createLanguageModel(input.provider, input.model)
    const result = streamText({
      model,
      system: input.systemPrompt,
      prompt: input.userPrompt,
      temperature: input.temperature ?? TEMPERATURE_COMPLETION,
      abortSignal,
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
          controller.error(
            new AiCompletionError(
              formatAiProviderErrorMessage(error, {
                operation: 'AI text generation stream request',
                service: 'AI text generation service',
              }),
              502,
            ),
          )
        }
      },
    })

    return {
      stream,
      model: createAiModelRef(input.provider.id, input.model),
    }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    console.error('AI provider error:', error)
    throw new AiCompletionError(
      formatAiProviderErrorMessage(error, {
        operation: 'AI text generation stream request',
        service: 'AI text generation service',
      }),
      502,
    )
  }
}

export async function requestAiEmbedding(input: {
  provider: ResolvedAiProviderConfig
  texts: string[]
  model: string
  abortSignal?: AbortSignal
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  if (input.texts.length === 0) {
    return { embeddings: [] }
  }

  try {
    const model = createEmbeddingModel(input.provider, input.model)
    const providerOptions = getEmbeddingProviderOptions(input.provider)
    const requestBatchSize = Math.max(1, EMBEDDING_REQUEST_BATCH_SIZE)
    const embeddings: number[][] = []

    for (let i = 0; i < input.texts.length; i += requestBatchSize) {
      const batchTexts = input.texts.slice(i, i + requestBatchSize)
      const batchEmbeddings = await requestEmbeddingBatchWithAdaptiveSplitting({
        model,
        texts: batchTexts,
        abortSignal: input.abortSignal,
        providerOptions,
      })

      if (batchEmbeddings.length !== batchTexts.length) {
        throw new Error(
          `Embedding count mismatch: expected ${batchTexts.length}, got ${batchEmbeddings.length}`,
        )
      }

      embeddings.push(...batchEmbeddings)
    }

    return { embeddings }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    console.error('AI embedding error:', error)
    throw new AiCompletionError(
      formatAiProviderErrorMessage(error, {
        operation: 'AI embedding request',
        service: 'AI embedding service',
      }),
      502,
    )
  }
}

export async function requestAiRerank(input: {
  provider: ResolvedAiProviderConfig
  model: string
  query: string
  documents: string[]
  topN?: number
  abortSignal?: AbortSignal
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  if (input.documents.length === 0) {
    return { results: [] as Array<{ index: number; relevanceScore: number }> }
  }

  if (input.provider.providerType !== 'openai_compatible') {
    throw new AiCompletionError(
      'Reranking is only supported for OpenAI-compatible providers.',
      501,
    )
  }

  const endpoint = `${input.provider.baseUrl.replace(/\/$/, '')}/rerank`

  try {
    const requestBatchSize = Math.max(1, AI_RERANK_REQUEST_BATCH_SIZE)
    const candidates = input.documents.map((document, index) => ({
      index,
      document,
    }))
    const results: Array<{ index: number; relevanceScore: number }> = []

    for (let i = 0; i < candidates.length; i += requestBatchSize) {
      const batchCandidates = candidates.slice(i, i + requestBatchSize)
      const batchResults = await requestRerankBatchWithAdaptiveSplitting({
        endpoint,
        provider: input.provider,
        model: input.model,
        query: input.query,
        candidates: batchCandidates,
        abortSignal: input.abortSignal,
      })
      results.push(...batchResults)
    }

    const topN = Math.max(
      1,
      Math.min(input.topN ?? input.documents.length, input.documents.length),
    )

    return {
      results: results
        .sort(
          (left, right) =>
            right.relevanceScore - left.relevanceScore || left.index - right.index,
        )
        .slice(0, topN),
    }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    console.error('AI reranker error:', error)
    throw new AiCompletionError(
      formatAiProviderErrorMessage(error, {
        operation: 'AI rerank request',
        service: 'AI rerank service',
      }),
      502,
    )
  }
}

export async function requestAiChatCompletionStream(input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model: string
  temperature?: number
  tools?: ToolSet
  maxSteps?: number
  abortSignal?: AbortSignal
}) {
  if (!input.provider.apiKey.trim()) {
    throw new AiCompletionError('This AI provider is missing an API key.', 503)
  }

  try {
    const abortSignal = createTimeoutAbortSignal(
      AI_PROVIDER_REQUEST_TIMEOUT_MS,
      input.abortSignal,
    )
    const model = createLanguageModel(input.provider, input.model)
    const toolNames = new Set<string>()
    let resolveAttribution: (
      value: ReturnType<typeof createChatMessageAttribution>,
    ) => void = () => {}
    const attributionPromise = new Promise<ReturnType<typeof createChatMessageAttribution>>(
      (resolve) => {
        resolveAttribution = resolve
      },
    )
    let attributionResolved = false
    const finishAttribution = (
      value: ReturnType<typeof createChatMessageAttribution>,
    ) => {
      if (attributionResolved) return
      attributionResolved = true
      resolveAttribution(value)
    }
    const result = streamText({
      model,
      system: input.systemPrompt,
      messages: input.messages,
      temperature: input.temperature ?? TEMPERATURE_CHAT,
      abortSignal,
      ...(input.tools ? { tools: input.tools, maxSteps: input.maxSteps ?? 1 } : {}),
      onStepFinish(step) {
        for (const toolName of collectMcpToolNamesFromSteps([step])) {
          toolNames.add(toolName)
        }
      },
      onFinish(event) {
        for (const toolName of collectMcpToolNamesFromSteps(event.steps)) {
          toolNames.add(toolName)
        }
        finishAttribution(
          createChatMessageAttribution({
            mcpToolNames: toolNames,
          }),
        )
      },
      onError() {
        finishAttribution(
          createChatMessageAttribution({
            mcpToolNames: toolNames,
          }),
        )
      },
      onAbort() {
        finishAttribution(
          createChatMessageAttribution({
            mcpToolNames: toolNames,
          }),
        )
      },
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
          controller.error(
            new AiCompletionError(
              formatAiProviderErrorMessage(error, {
                operation: 'AI chat request',
                service: 'AI chat service',
              }),
              502,
            ),
          )
        }
      },
    })

    return {
      stream,
      model: createAiModelRef(input.provider.id, input.model),
      attributionPromise,
    }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    console.error('AI chat provider error:', error)
    throw new AiCompletionError(
      formatAiProviderErrorMessage(error, {
        operation: 'AI chat request',
        service: 'AI chat service',
      }),
      502,
    )
  }
}

export async function resolveEmbeddingProvider(workspaceId: string) {
  void workspaceId
  const provider: ResolvedAiProviderConfig = {
    id: HARDCODED_EMBEDDING_PROVIDER_ID,
    name: HARDCODED_EMBEDDING_PROVIDER_NAME,
    providerType: 'openai_compatible',
    baseUrl: HARDCODED_EMBEDDING_BASE_URL,
    apiKey: 'ollama',
    defaultModelId: HARDCODED_EMBEDDING_MODEL,
    enabled: true,
    source: 'env',
  }
  return {
    provider,
    modelId: DEFAULT_EMBEDDING_MODEL,
  }
}
