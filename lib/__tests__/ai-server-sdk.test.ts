import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ResolvedAiProviderConfig } from '@/lib/ai-server-types'

const {
  embedManyMock,
  createGoogleGenerativeAIMock,
  googleTextEmbeddingModelMock,
  resolveWorkspaceAiProvidersMock,
  getAiWorkspaceSettingsMock,
} = vi.hoisted(() => ({
  embedManyMock: vi.fn(),
  createGoogleGenerativeAIMock: vi.fn(),
  googleTextEmbeddingModelMock: vi.fn(),
  resolveWorkspaceAiProvidersMock: vi.fn(),
  getAiWorkspaceSettingsMock: vi.fn(),
}))

vi.mock('ai', () => ({
  embedMany: embedManyMock,
  generateText: vi.fn(),
  streamText: vi.fn(),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: createGoogleGenerativeAIMock,
}))

vi.mock('@/lib/ai-server-providers', () => ({
  resolveWorkspaceAiProviders: resolveWorkspaceAiProvidersMock,
}))

vi.mock('@/lib/queries/ai', () => ({
  getAiWorkspaceSettings: getAiWorkspaceSettingsMock,
}))

const geminiProvider: ResolvedAiProviderConfig = {
  id: 'provider-1',
  name: 'Gemini',
  providerType: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: 'test-key',
  defaultModelId: 'gemini-2.5-flash',
  enabled: true,
  source: 'database',
}

describe('ai-server-sdk embedding behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    googleTextEmbeddingModelMock.mockReturnValue({ id: 'embedding-model' })
    createGoogleGenerativeAIMock.mockReturnValue({
      textEmbeddingModel: googleTextEmbeddingModelMock,
    })
    embedManyMock.mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
    })
  })

  it('uses a Gemini-specific embedding fallback when no embedding model is configured', async () => {
    resolveWorkspaceAiProvidersMock.mockResolvedValue([geminiProvider])
    getAiWorkspaceSettingsMock.mockResolvedValue(null)

    const { resolveEmbeddingProvider } = await import('@/lib/ai-server')
    const result = await resolveEmbeddingProvider('ws-1')

    expect(result).toEqual({
      provider: geminiProvider,
      modelId: 'gemini-embedding-001',
    })
  })

  it('respects an explicitly configured embedding model id', async () => {
    resolveWorkspaceAiProvidersMock.mockResolvedValue([geminiProvider])
    getAiWorkspaceSettingsMock.mockResolvedValue({
      embeddingModelId: 'custom-embedding-model',
    })

    const { resolveEmbeddingProvider } = await import('@/lib/ai-server')
    const result = await resolveEmbeddingProvider('ws-1')

    expect(result).toEqual({
      provider: geminiProvider,
      modelId: 'custom-embedding-model',
    })
  })

  it('requests Gemini embeddings with the repository vector dimension', async () => {
    const { requestAiEmbedding } = await import('@/lib/ai-server')

    await requestAiEmbedding({
      provider: geminiProvider,
      texts: ['hello world'],
      model: 'models/gemini-embedding-001',
    })

    expect(googleTextEmbeddingModelMock).toHaveBeenCalledWith(
      'gemini-embedding-001',
    )
    expect(embedManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ['hello world'],
        providerOptions: {
          google: {
            outputDimensionality: 1536,
          },
        },
      }),
    )
  })
})
