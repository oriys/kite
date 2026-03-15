import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, streamText, embedMany } from 'ai'
import type { LanguageModel, EmbeddingModel } from 'ai'

import { createAiModelRef } from '@/lib/ai'
import { TEMPERATURE_CHAT, TEMPERATURE_COMPLETION } from '@/lib/ai-config'
import {
  AiCompletionError,
  type OpenAiCompatibleRerankResponse,
  type ResolvedAiProviderConfig,
} from './ai-server-types'
import { getNumber } from './ai-server-helpers'

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
      temperature: input.temperature ?? TEMPERATURE_COMPLETION,
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
      temperature: input.temperature ?? TEMPERATURE_COMPLETION,
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

export async function requestAiRerank(input: {
  provider: ResolvedAiProviderConfig
  model: string
  query: string
  documents: string[]
  topN?: number
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
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${input.provider.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        query: input.query,
        documents: input.documents,
        top_n: Math.max(1, Math.min(input.topN ?? input.documents.length, input.documents.length)),
        return_documents: false,
      }),
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

    const results = rows
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const record = row as Record<string, unknown>
        const index = getNumber(record.index)
        const relevanceScore =
          getNumber(record.relevance_score) ??
          getNumber(record.score) ??
          getNumber(record.relevanceScore)

        if (index === null || relevanceScore === null) return null
        if (index < 0 || index >= input.documents.length) return null

        return {
          index,
          relevanceScore,
        }
      })
      .filter((result): result is { index: number; relevanceScore: number } => result !== null)
      .sort(
        (left, right) =>
          right.relevanceScore - left.relevanceScore || left.index - right.index,
      )

    return { results }
  } catch (error) {
    if (error instanceof AiCompletionError) throw error
    const message = error instanceof Error ? error.message : 'The reranker request failed.'
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
      temperature: input.temperature ?? TEMPERATURE_CHAT,
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
