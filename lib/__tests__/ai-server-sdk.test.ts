import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createOpenAIMock,
  embeddingModelMock,
  embedManyMock,
  generateTextMock,
  streamTextMock,
} = vi.hoisted(() => ({
  createOpenAIMock: vi.fn(),
  embeddingModelMock: vi.fn(),
  embedManyMock: vi.fn(),
  generateTextMock: vi.fn(),
  streamTextMock: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: createOpenAIMock,
}))

vi.mock('ai', () => ({
  embedMany: embedManyMock,
  generateText: generateTextMock,
  streamText: streamTextMock,
}))

vi.mock('@/lib/ai-config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai-config')>('@/lib/ai-config')
  return {
    ...actual,
    AI_IDEMPOTENT_RETRY_DELAY_MS: 0,
    EMBEDDING_REQUEST_BATCH_SIZE: 5,
  }
})

describe('ai-server-sdk embedding behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    embeddingModelMock.mockReturnValue({ id: 'ollama-embedding-model' })
    createOpenAIMock.mockReturnValue({
      embedding: embeddingModelMock,
      chat: vi.fn(),
    })
    embedManyMock.mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
    })
    generateTextMock.mockResolvedValue({
      text: 'generated text',
    })
    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        yield 'streamed text'
      })(),
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('resolves the hardcoded local Ollama embedding route', async () => {
    const { resolveEmbeddingProvider } = await import('@/lib/ai-server-sdk')
    const result = await resolveEmbeddingProvider('ws-1')

    expect(result).toEqual({
      provider: {
        id: 'ollama-local',
        name: 'Ollama',
        providerType: 'openai_compatible',
        baseUrl: 'http://127.0.0.1:11434/v1',
        apiKey: 'ollama',
        defaultModelId: 'qwen3-embedding:4b',
        enabled: true,
        source: 'env',
      },
      modelId: 'qwen3-embedding:4b',
    })
  })

  it('requests embeddings through the hardcoded Ollama route', async () => {
    const { requestAiEmbedding, resolveEmbeddingProvider } = await import(
      '@/lib/ai-server-sdk'
    )
    const config = await resolveEmbeddingProvider('ws-1')

    await requestAiEmbedding({
      provider: config.provider,
      texts: ['hello world'],
      model: config.modelId,
    })

    expect(createOpenAIMock).toHaveBeenCalledWith({
      baseURL: 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
    })
    expect(embeddingModelMock).toHaveBeenCalledWith('qwen3-embedding:4b')
    expect(embedManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ['hello world'],
      }),
    )
  })

  it('proactively splits large embedding requests before calling the provider', async () => {
    const { requestAiEmbedding, resolveEmbeddingProvider } = await import(
      '@/lib/ai-server-sdk'
    )
    const { EMBEDDING_REQUEST_BATCH_SIZE } = await import('@/lib/ai-config')
    const config = await resolveEmbeddingProvider('ws-1')
    const texts = Array.from(
      { length: EMBEDDING_REQUEST_BATCH_SIZE + 1 },
      (_, index) => `text-${index + 1}`
    )
    const firstBatchTexts = texts.slice(0, EMBEDDING_REQUEST_BATCH_SIZE)
    const secondBatchTexts = texts.slice(EMBEDDING_REQUEST_BATCH_SIZE)
    const firstBatchEmbeddings = firstBatchTexts.map((_, index) => [index + 1])
    const secondBatchEmbeddings = secondBatchTexts.map(
      (_, index) => [EMBEDDING_REQUEST_BATCH_SIZE + index + 1]
    )

    embedManyMock
      .mockResolvedValueOnce({
        embeddings: firstBatchEmbeddings,
      })
      .mockResolvedValueOnce({
        embeddings: secondBatchEmbeddings,
      })

    const result = await requestAiEmbedding({
      provider: config.provider,
      texts,
      model: config.modelId,
    })

    expect(result).toEqual({
      embeddings: [...firstBatchEmbeddings, ...secondBatchEmbeddings],
    })
    expect(embedManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        values: firstBatchTexts,
      }),
    )
    expect(embedManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        values: secondBatchTexts,
      }),
    )
    expect(embedManyMock.mock.calls[0]?.[0]?.abortSignal).not.toBe(
      embedManyMock.mock.calls[1]?.[0]?.abortSignal
    )
  })

  it('splits retryable embedding batches into smaller requests', async () => {
    const { requestAiEmbedding, resolveEmbeddingProvider } = await import(
      '@/lib/ai-server-sdk'
    )
    const { AI_IDEMPOTENT_REQUEST_MAX_ATTEMPTS } = await import('@/lib/ai-config')
    const config = await resolveEmbeddingProvider('ws-1')

    const retryableError = new Error(
      'Failed after 3 attempts. Last error: Cannot connect to API: Headers Timeout Error'
    )
    for (let i = 0; i < AI_IDEMPOTENT_REQUEST_MAX_ATTEMPTS; i++) {
      embedManyMock.mockRejectedValueOnce(retryableError)
    }
    embedManyMock
      .mockResolvedValueOnce({
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      })
      .mockResolvedValueOnce({
        embeddings: [
          [0.7, 0.8, 0.9],
          [1.0, 1.1, 1.2],
        ],
      })

    const result = await requestAiEmbedding({
      provider: config.provider,
      texts: ['a', 'b', 'c', 'd'],
      model: config.modelId,
    })

    expect(result).toEqual({
      embeddings: [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
        [1.0, 1.1, 1.2],
      ],
    })
    // First MAX_ATTEMPTS calls are retries of the full batch
    for (let i = 1; i <= AI_IDEMPOTENT_REQUEST_MAX_ATTEMPTS; i++) {
      expect(embedManyMock).toHaveBeenNthCalledWith(
        i,
        expect.objectContaining({
          values: ['a', 'b', 'c', 'd'],
        }),
      )
    }
    // After exhausting retries, adaptive split into two halves
    expect(embedManyMock).toHaveBeenNthCalledWith(
      AI_IDEMPOTENT_REQUEST_MAX_ATTEMPTS + 1,
      expect.objectContaining({
        values: ['a', 'b'],
      }),
    )
    expect(embedManyMock).toHaveBeenNthCalledWith(
      AI_IDEMPOTENT_REQUEST_MAX_ATTEMPTS + 2,
      expect.objectContaining({
        values: ['c', 'd'],
      }),
    )
  })

  it('surfaces timeout-specific embedding failures', async () => {
    const { requestAiEmbedding, resolveEmbeddingProvider } = await import(
      '@/lib/ai-server-sdk'
    )
    const config = await resolveEmbeddingProvider('ws-1')

    embedManyMock.mockRejectedValue(
      new Error('Failed after 3 attempts. Last error: Cannot connect to API: Headers Timeout Error')
    )

    await expect(
      requestAiEmbedding({
        provider: config.provider,
        texts: ['hello world'],
        model: config.modelId,
      })
    ).rejects.toMatchObject({
      name: 'AiCompletionError',
      message: 'AI embedding request timed out while contacting the provider.',
      status: 502,
    })
  })

  it('surfaces timeout-specific text generation failures', async () => {
    const { requestAiTextCompletion, resolveEmbeddingProvider } = await import(
      '@/lib/ai-server-sdk'
    )
    const config = await resolveEmbeddingProvider('ws-1')

    generateTextMock.mockRejectedValueOnce(
      new Error('Failed after 3 attempts. Last error: Cannot connect to API: Headers Timeout Error')
    )

    await expect(
      requestAiTextCompletion({
        provider: config.provider,
        systemPrompt: 'system',
        userPrompt: 'user',
        model: config.modelId,
      })
    ).rejects.toMatchObject({
      name: 'AiCompletionError',
      message: 'AI text generation request timed out while contacting the provider.',
      status: 502,
    })
  })

  it('proactively batches rerank requests and preserves global indices', async () => {
    const { requestAiRerank, resolveEmbeddingProvider } = await import(
      '@/lib/ai-server-sdk'
    )
    const { AI_RERANK_REQUEST_BATCH_SIZE } = await import('@/lib/ai-config')
    const config = await resolveEmbeddingProvider('ws-1')
    const documents = Array.from(
      { length: AI_RERANK_REQUEST_BATCH_SIZE + 1 },
      (_, index) => `document-${index + 1}`
    )
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { index: 0, relevance_score: 0.61 },
            { index: 1, relevance_score: 0.55 },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { index: 0, relevance_score: 0.99 },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestAiRerank({
      provider: config.provider,
      model: 'rerank-model',
      query: 'find the best docs',
      documents,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).documents
    ).toEqual(documents.slice(0, AI_RERANK_REQUEST_BATCH_SIZE))
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).documents
    ).toEqual(documents.slice(AI_RERANK_REQUEST_BATCH_SIZE))
    expect(result.results).toEqual([
      { index: AI_RERANK_REQUEST_BATCH_SIZE, relevanceScore: 0.99 },
      { index: 0, relevanceScore: 0.61 },
      { index: 1, relevanceScore: 0.55 },
    ])
  })

  it('surfaces timeout-specific rerank failures', async () => {
    const { requestAiRerank, resolveEmbeddingProvider } = await import(
      '@/lib/ai-server-sdk'
    )
    const config = await resolveEmbeddingProvider('ws-1')
    const fetchMock = vi.fn().mockRejectedValue(
      new Error('Failed after 3 attempts. Last error: Cannot connect to API: Headers Timeout Error')
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      requestAiRerank({
        provider: config.provider,
        model: 'rerank-model',
        query: 'find the best docs',
        documents: ['one'],
      })
    ).rejects.toMatchObject({
      name: 'AiCompletionError',
      message: 'AI rerank request timed out while contacting the provider.',
      status: 502,
    })
  })

  it('uses a fresh timeout signal for each rerank retry attempt', async () => {
    const { requestAiRerank, resolveEmbeddingProvider } = await import(
      '@/lib/ai-server-sdk'
    )
    const config = await resolveEmbeddingProvider('ws-1')
    const requestSignals: AbortSignal[] = []
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_input, init) => {
        requestSignals.push(init?.signal as AbortSignal)
        throw new DOMException('Timed out', 'TimeoutError')
      })
      .mockImplementationOnce(async (_input, init) => {
        requestSignals.push(init?.signal as AbortSignal)
        return {
          ok: true,
          json: async () => ({
            results: [{ index: 0, relevance_score: 0.91 }],
          }),
        }
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestAiRerank({
      provider: config.provider,
      model: 'rerank-model',
      query: 'find the best docs',
      documents: ['one'],
    })

    expect(result.results).toEqual([{ index: 0, relevanceScore: 0.91 }])
    expect(requestSignals).toHaveLength(2)
    expect(requestSignals[0]).not.toBe(requestSignals[1])
  })
})
