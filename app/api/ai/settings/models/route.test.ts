import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  withWorkspaceAuthMock,
  getAiWorkspaceSettingsMock,
  upsertAiWorkspaceModelSettingsMock,
} = vi.hoisted(() => ({
  withWorkspaceAuthMock: vi.fn(),
  getAiWorkspaceSettingsMock: vi.fn(),
  upsertAiWorkspaceModelSettingsMock: vi.fn(),
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
  })

  it('clears stored embedding settings while saving model preferences', async () => {
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
      embeddingProviderId: null,
      embeddingModelId: null,
      rerankerModelId: 'reranker-1',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      defaultModelId: 'provider-openai::gpt-4.1',
      enabledModelIds: ['provider-openai::gpt-4.1'],
      embeddingProviderId: 'ollama-local',
      embeddingModelId: 'qwen3-embedding:4b',
      rerankerModelId: 'reranker-1',
    })
  })

  it('ignores incoming embedding routing fields', async () => {
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
      embeddingProviderId: null,
      embeddingModelId: null,
      rerankerModelId: 'reranker-1',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      defaultModelId: 'provider-chat::gpt-4o-mini',
      enabledModelIds: ['provider-chat::gpt-4o-mini'],
      embeddingProviderId: 'ollama-local',
      embeddingModelId: 'qwen3-embedding:4b',
      rerankerModelId: 'reranker-1',
    })
  })
})
