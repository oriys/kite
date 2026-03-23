import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  withWorkspaceAuthMock,
  getAiWorkspaceSettingsMock,
  loadWorkspaceAiCatalogMock,
  resolveEmbeddingProviderMock,
} = vi.hoisted(() => ({
  withWorkspaceAuthMock: vi.fn(),
  getAiWorkspaceSettingsMock: vi.fn(),
  loadWorkspaceAiCatalogMock: vi.fn(),
  resolveEmbeddingProviderMock: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  withWorkspaceAuth: withWorkspaceAuthMock,
}))

vi.mock('@/lib/queries/ai', () => ({
  getAiWorkspaceSettings: getAiWorkspaceSettingsMock,
}))

vi.mock('@/lib/ai-server', () => ({
  loadWorkspaceAiCatalog: loadWorkspaceAiCatalogMock,
  resolveEmbeddingProvider: resolveEmbeddingProviderMock,
}))

describe('GET /api/ai/models', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    withWorkspaceAuthMock.mockResolvedValue({
      ctx: {
        workspaceId: 'ws_123',
        userId: 'user_123',
        role: 'guest',
      },
    })

    getAiWorkspaceSettingsMock.mockResolvedValue({
      defaultModelId: 'provider-chat::gpt-4o-mini',
      enabledModelIds: ['provider-chat::gpt-4o-mini'],
      embeddingProviderId: 'provider-gemini',
      embeddingModelId: 'gemini-embedding-001',
      rerankerModelId: 'reranker-1',
    })

    loadWorkspaceAiCatalogMock.mockResolvedValue({
      configured: true,
      error: undefined,
      providers: [
        {
          id: 'provider-gemini',
          name: 'Google Gemini',
          providerType: 'gemini',
          providerLabel: 'Google Gemini',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          defaultModelId: 'gemini-2.5-flash',
          enabled: true,
          source: 'database',
          modelCount: 1,
        },
        {
          id: 'provider-chat',
          name: 'OpenAI',
          providerType: 'openai_compatible',
          providerLabel: 'OpenAI-compatible',
          baseUrl: 'https://api.openai.com/v1',
          defaultModelId: 'gpt-4o-mini',
          enabled: true,
          source: 'database',
          modelCount: 1,
        },
      ],
      models: [
        {
          id: 'provider-chat::gpt-4o-mini',
          modelId: 'gpt-4o-mini',
          label: 'GPT-4o mini',
          provider: 'OpenAI',
          providerId: 'provider-chat',
          providerType: 'openai_compatible',
          description: '',
          contextWindow: 128000,
          capabilities: ['chat'],
        },
      ],
    })

    resolveEmbeddingProviderMock.mockResolvedValue({
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

  it('returns the hardcoded Ollama embedding route', async () => {
    const { GET } = await import('./route')

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        configured: true,
        defaultModelId: 'provider-chat::gpt-4o-mini',
        enabledModelIds: ['provider-chat::gpt-4o-mini'],
        embeddingProviderId: 'ollama-local',
        embeddingModelId: 'qwen3-embedding:4b',
        resolvedEmbeddingProviderId: 'ollama-local',
        resolvedEmbeddingModelId: 'qwen3-embedding:4b',
        rerankerModelId: 'reranker-1',
      }),
    )
  })
})
