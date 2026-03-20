import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  withWorkspaceAuthMock,
  getAiWorkspaceSettingsMock,
  upsertAiWorkspaceModelSettingsMock,
  resolveWorkspaceAiProvidersMock,
} = vi.hoisted(() => ({
  withWorkspaceAuthMock: vi.fn(),
  getAiWorkspaceSettingsMock: vi.fn(),
  upsertAiWorkspaceModelSettingsMock: vi.fn(),
  resolveWorkspaceAiProvidersMock: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  badRequest: (message: string) =>
    NextResponse.json({ error: message }, { status: 400 }),
  withWorkspaceAuth: withWorkspaceAuthMock,
}))

vi.mock('@/lib/queries/ai', () => ({
  getAiWorkspaceSettings: getAiWorkspaceSettingsMock,
  upsertAiWorkspaceModelSettings: upsertAiWorkspaceModelSettingsMock,
}))

vi.mock('@/lib/ai-server', () => ({
  resolveWorkspaceAiProviders: resolveWorkspaceAiProvidersMock,
}))

describe('PUT /api/ai/settings/models', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    withWorkspaceAuthMock.mockResolvedValue({
      ctx: {
        workspaceId: 'ws_123',
        userId: 'user_123',
        role: 'member',
      },
    })

    getAiWorkspaceSettingsMock.mockResolvedValue({
      defaultModelId: 'provider-chat::gpt-4o-mini',
      enabledModelIds: ['provider-chat::gpt-4o-mini'],
      embeddingProviderId: 'provider-embedding',
      embeddingModelId: 'gemini-embedding-001',
      rerankerModelId: 'reranker-1',
    })

    resolveWorkspaceAiProvidersMock.mockResolvedValue([
      {
        id: 'provider-embedding',
        name: 'Gemini',
        providerType: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        defaultModelId: 'gemini-2.5-flash',
        enabled: true,
        source: 'database',
      },
      {
        id: 'provider-openai',
        name: 'OpenAI',
        providerType: 'openai_compatible',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        defaultModelId: 'gpt-4o-mini',
        enabled: true,
        source: 'database',
      },
      {
        id: 'provider-anthropic',
        name: 'Anthropic',
        providerType: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'test-key',
        defaultModelId: 'claude-sonnet-4-5',
        enabled: true,
        source: 'database',
      },
    ])
  })

  it('preserves embedding settings during model preference updates', async () => {
    const { PUT } = await import('./route')

    const response = await PUT(
      new Request('http://localhost/api/ai/settings/models', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          defaultModelId: 'provider-openai::gpt-4.1',
          enabledModelIds: ['provider-openai::gpt-4.1'],
        }),
      }) as never,
    )

    expect(upsertAiWorkspaceModelSettingsMock).toHaveBeenCalledWith('ws_123', {
      defaultModelId: 'provider-openai::gpt-4.1',
      enabledModelIds: ['provider-openai::gpt-4.1'],
      embeddingProviderId: 'provider-embedding',
      embeddingModelId: 'gemini-embedding-001',
      rerankerModelId: 'reranker-1',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      defaultModelId: 'provider-openai::gpt-4.1',
      enabledModelIds: ['provider-openai::gpt-4.1'],
      embeddingProviderId: 'provider-embedding',
      embeddingModelId: 'gemini-embedding-001',
      rerankerModelId: 'reranker-1',
    })
  })

  it('saves explicit embedding provider and model settings', async () => {
    const { PUT } = await import('./route')

    const response = await PUT(
      new Request('http://localhost/api/ai/settings/models', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          embeddingProviderId: 'provider-openai',
          embeddingModelId: 'text-embedding-3-large',
        }),
      }) as never,
    )

    expect(upsertAiWorkspaceModelSettingsMock).toHaveBeenCalledWith('ws_123', {
      defaultModelId: 'provider-chat::gpt-4o-mini',
      enabledModelIds: ['provider-chat::gpt-4o-mini'],
      embeddingProviderId: 'provider-openai',
      embeddingModelId: 'text-embedding-3-large',
      rerankerModelId: 'reranker-1',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      defaultModelId: 'provider-chat::gpt-4o-mini',
      enabledModelIds: ['provider-chat::gpt-4o-mini'],
      embeddingProviderId: 'provider-openai',
      embeddingModelId: 'text-embedding-3-large',
      rerankerModelId: 'reranker-1',
    })
  })

  it('rejects providers that do not support embeddings', async () => {
    const { PUT } = await import('./route')

    const response = await PUT(
      new Request('http://localhost/api/ai/settings/models', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          embeddingProviderId: 'provider-anthropic',
        }),
      }) as never,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Selected provider does not support embeddings.',
    })
    expect(upsertAiWorkspaceModelSettingsMock).not.toHaveBeenCalled()
  })
})
