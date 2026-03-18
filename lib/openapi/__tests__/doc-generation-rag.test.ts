const {
  resolveDocGenerationSelectionMock,
  requestAiTextCompletionMock,
  retrieveWorkspaceRagContextMock,
  resolveWorkspaceRagQueryModeMock,
} = vi.hoisted(() => ({
  resolveDocGenerationSelectionMock: vi.fn(),
  requestAiTextCompletionMock: vi.fn(),
  retrieveWorkspaceRagContextMock: vi.fn(),
  resolveWorkspaceRagQueryModeMock: vi.fn(),
}))

vi.mock('@/lib/server-errors', () => ({
  logServerError: vi.fn(),
}))

vi.mock('@/lib/ai-chat', () => ({
  retrieveWorkspaceRagContext: retrieveWorkspaceRagContextMock,
}))

vi.mock('@/lib/openapi/doc-generation-model', () => ({
  resolveDocGenerationSelection: resolveDocGenerationSelectionMock,
}))

vi.mock('@/lib/ai-server', () => ({
  requestAiTextCompletion: requestAiTextCompletionMock,
}))

vi.mock('@/lib/rag/settings', () => ({
  resolveWorkspaceRagQueryMode: resolveWorkspaceRagQueryModeMock,
}))

import {
  retrieveDocGenerationContext,
} from '@/lib/openapi/doc-generation-rag'
import type { ParsedEndpoint } from '@/lib/openapi/parser'

describe('doc generation RAG helper', () => {
  const endpoint: ParsedEndpoint = {
    method: 'POST',
    path: '/orders',
    operationId: 'createOrder',
    summary: 'Create order',
    description: 'Create a new order.',
    tags: ['Orders'],
    parameters: [],
    requestBody: null,
    responses: {
      '201': {
        description: 'Created',
      },
    },
    deprecated: false,
    security: null,
  }

  beforeEach(() => {
    resolveWorkspaceRagQueryModeMock.mockResolvedValue('hybrid')
    resolveDocGenerationSelectionMock.mockResolvedValue({
      provider: 'openai',
      modelId: 'gpt-test',
    })
    requestAiTextCompletionMock.mockResolvedValue({
      result: [
        'English: Orders API idempotency guide',
        'Chinese: 订单 API 幂等性 指南',
      ].join('\n'),
      model: 'gpt-test',
    })
    retrieveWorkspaceRagContextMock.mockResolvedValue({
      contextText:
        'Workspace snippet: Orders service requires OAuth scopes for partner write access.',
      sources: [{ documentId: 'doc_workspace_1' }],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('builds context from inline supplemental materials', async () => {
    const result = await retrieveDocGenerationContext({
      workspaceId: 'ws_test',
      sourceName: 'Orders Source',
      apiTitle: 'Orders API',
      userPrompt:
        'Create an onboarding guide that explains idempotency and rate limits.',
      documentType: 'guide',
      endpoints: [endpoint],
      materials: [
        {
          title: 'Release Notes',
          sourceType: 'markdown',
          rawContent: [
            '# Release Notes',
            '',
            '## Reliability',
            'Send an `Idempotency-Key` header for order creation requests.',
            '',
            '## Limits',
            'Current write traffic is rate limited to 50 requests per minute.',
          ].join('\n'),
        },
      ],
      multiTurn: false,
    })

    expect(result).not.toBeNull()
    expect(result?.contextText).toContain('Release Notes')
    expect(result?.contextText).toContain('Idempotency-Key')
    expect(result?.contextText).toContain('50 requests per minute')
    expect(result?.contextText).toContain('Workspace knowledge base')
    expect(result?.contextText).toContain('OAuth scopes')
    expect(result?.materialTitles).toEqual(['Release Notes'])
    expect(result?.workspaceSourceCount).toBe(1)
    expect(result?.ragMode).toBe('hybrid')
    expect(requestAiTextCompletionMock).toHaveBeenCalledTimes(1)
    expect(retrieveWorkspaceRagContextMock).toHaveBeenCalledTimes(1)
    expect(result?.queryVariants).toEqual(
      expect.arrayContaining([
        'Orders API idempotency guide',
        '订单 API 幂等性 指南',
      ]),
    )
  })

  it('fetches and extracts URL supplemental materials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          '<html>',
          '<head><title>Migration Guide</title></head>',
          '<body>',
          '<main>',
          '<h1>OAuth migration</h1>',
          '<p>Move from API keys to OAuth scopes for partner integrations.</p>',
          '</main>',
          '</body>',
          '</html>',
        ].join(''),
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        },
      ),
    )

    vi.stubGlobal('fetch', fetchMock)

    const result = await retrieveDocGenerationContext({
      workspaceId: 'ws_test',
      sourceName: 'Orders Source',
      apiTitle: 'Orders API',
      userPrompt: 'Explain the partner authentication migration plan.',
      documentType: 'guide',
      endpoints: [endpoint],
      materials: [
        {
          title: 'Auth migration',
          sourceType: 'url',
          sourceUrl: 'https://example.com/migration-guide',
        },
      ],
      multiTurn: false,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).not.toBeNull()
    expect(result?.contextText).toContain('Auth migration')
    expect(result?.contextText).toContain('OAuth migration')
    expect(result?.contextText).toContain('OAuth scopes')
    expect(result?.materialTitles).toEqual(['Auth migration'])
  })

  it('uses material titles as fallback retrieval hints for materials-only generation', async () => {
    const result = await retrieveDocGenerationContext({
      workspaceId: 'ws_test',
      sourceName: 'Orders Source',
      apiTitle: 'Orders API',
      userPrompt: '',
      documentType: 'guide',
      endpoints: [],
      materials: [
        {
          title: 'Internal Notes',
          sourceType: 'markdown',
          rawContent: [
            '# Internal Notes',
            '',
            'General housekeeping reminders for the support team.',
          ].join('\n'),
        },
        {
          title: 'OAuth migration guide',
          sourceType: 'markdown',
          rawContent: [
            '# OAuth migration guide',
            '',
            'Move partner integrations from API keys to OAuth scopes.',
          ].join('\n'),
        },
      ],
      multiTurn: false,
    })

    expect(result).not.toBeNull()
    expect(result?.queryVariants[0]).toContain('OAuth migration guide')
    expect(result?.queryVariants).toContain('订单 API 幂等性 指南')
    expect(result?.contextText).toContain('OAuth migration guide')
  })

  it('can return workspace KB context even without supplemental materials', async () => {
    const result = await retrieveDocGenerationContext({
      workspaceId: 'ws_test',
      sourceName: 'Orders Source',
      apiTitle: 'Orders API',
      userPrompt: 'Create a high-level overview for partner onboarding.',
      documentType: 'guide',
      endpoints: [endpoint],
      materials: [],
      multiTurn: false,
      visibility: {
        userId: 'user_test',
        role: 'member',
      },
      ragMode: 'global',
    })

    expect(result).not.toBeNull()
    expect(result?.contextText).toContain('Workspace snippet')
    expect(result?.materialCount).toBe(0)
    expect(result?.workspaceSourceCount).toBe(1)
    expect(result?.ragMode).toBe('hybrid')
    expect(requestAiTextCompletionMock).not.toHaveBeenCalled()
    expect(retrieveWorkspaceRagContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_test',
        mode: 'hybrid',
      }),
    )
  })
})
