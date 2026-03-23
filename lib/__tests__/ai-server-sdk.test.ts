import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createOpenAIMock, embeddingModelMock, embedManyMock } = vi.hoisted(() => ({
  createOpenAIMock: vi.fn(),
  embeddingModelMock: vi.fn(),
  embedManyMock: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: createOpenAIMock,
}))

vi.mock('ai', () => ({
  embedMany: embedManyMock,
  generateText: vi.fn(),
  streamText: vi.fn(),
}))

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
})
