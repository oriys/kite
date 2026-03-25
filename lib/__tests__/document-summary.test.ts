import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requestAiTextCompletionMock,
  resolveAiModelSelectionMock,
  resolveWorkspaceAiProvidersMock,
  getAiWorkspaceSettingsMock,
  logServerErrorMock,
} = vi.hoisted(() => ({
  requestAiTextCompletionMock: vi.fn(),
  resolveAiModelSelectionMock: vi.fn(),
  resolveWorkspaceAiProvidersMock: vi.fn(),
  getAiWorkspaceSettingsMock: vi.fn(),
  logServerErrorMock: vi.fn(),
}))

vi.mock('@/lib/ai-server', () => ({
  requestAiTextCompletion: requestAiTextCompletionMock,
  resolveAiModelSelection: resolveAiModelSelectionMock,
  resolveWorkspaceAiProviders: resolveWorkspaceAiProvidersMock,
}))

vi.mock('@/lib/queries/ai', () => ({
  getAiWorkspaceSettings: getAiWorkspaceSettingsMock,
}))

vi.mock('@/lib/server-errors', () => ({
  logServerError: logServerErrorMock,
}))

vi.mock('@/lib/ai-config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai-config')>('@/lib/ai-config')
  return { ...actual, AI_IDEMPOTENT_RETRY_DELAY_MS: 0 }
})

import { generateDocumentMetadata } from '../document-summary'

const provider = {
  id: 'provider-1',
  name: 'Provider',
  providerType: 'openai_compatible' as const,
  baseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: 'test-key',
  defaultModelId: 'model-1',
  enabled: true,
  source: 'env' as const,
}

describe('generateDocumentMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveWorkspaceAiProvidersMock.mockResolvedValue([provider])
    getAiWorkspaceSettingsMock.mockResolvedValue({
      defaultModelId: 'model-1',
      enabledModelIds: ['model-1'],
    })
    resolveAiModelSelectionMock.mockReturnValue({
      provider,
      modelId: 'model-1',
    })
  })

  it('retries transient AI failures before returning structured metadata', async () => {
    requestAiTextCompletionMock
      .mockRejectedValueOnce(
        new Error('Failed after 3 attempts. Last error: Cannot connect to API: Headers Timeout Error')
      )
      .mockResolvedValueOnce({
        result: JSON.stringify({
          summary: 'Short summary',
          title: 'Useful title',
        }),
        model: 'provider-1:model-1',
      })

    const result = await generateDocumentMetadata({
      workspaceId: 'ws-1',
      title: '',
      content: '# Hello world\n\nThis is a useful document.',
    })

    expect(result).toEqual({
      summary: 'Short summary',
      title: 'Useful title',
    })
    expect(requestAiTextCompletionMock).toHaveBeenCalledTimes(2)
    expect(logServerErrorMock).not.toHaveBeenCalled()
  })

  it('falls back after repeated AI failures', async () => {
    requestAiTextCompletionMock.mockRejectedValue(
      new Error('Failed after 3 attempts. Last error: Cannot connect to API: Headers Timeout Error')
    )

    const result = await generateDocumentMetadata({
      workspaceId: 'ws-1',
      title: '',
      content: '# Hello world\n\nThis is a useful document.',
    })

    expect(result.summary).toContain('Hello world')
    expect(result.title).toBe('Hello world')
    expect(logServerErrorMock).toHaveBeenCalledTimes(1)
  })
})
