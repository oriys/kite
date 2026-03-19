import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  withWorkspaceAuthMock,
  selectMock,
  selectFromMock,
  selectWhereMock,
  insertMock,
  valuesMock,
  returningMock,
  parsePublicHttpUrlMock,
  deriveTitleFromUrlMock,
} = vi.hoisted(() => ({
  withWorkspaceAuthMock: vi.fn(),
  selectMock: vi.fn(),
  selectFromMock: vi.fn(),
  selectWhereMock: vi.fn(),
  insertMock: vi.fn(),
  valuesMock: vi.fn(),
  returningMock: vi.fn(),
  parsePublicHttpUrlMock: vi.fn(),
  deriveTitleFromUrlMock: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  badRequest: (message: string) =>
    NextResponse.json({ error: message }, { status: 400 }),
  withWorkspaceAuth: withWorkspaceAuthMock,
}))

vi.mock('@/lib/constants', () => ({
  MAX_IMPORT_COUNT: 200,
}))

vi.mock('@/lib/knowledge-source-content', () => ({
  EXTRACTABLE_KNOWLEDGE_SOURCE_TYPES: [
    'document',
    'pdf',
    'url',
    'markdown',
    'faq',
    'openapi',
    'graphql',
    'zip',
    'asyncapi',
    'protobuf',
    'rst',
    'asciidoc',
    'csv',
    'sql_ddl',
    'typescript_defs',
    'postman',
  ],
}))

vi.mock('@/lib/outbound-http', () => ({
  parsePublicHttpUrl: parsePublicHttpUrlMock,
}))

vi.mock('@/lib/public-url-content', () => ({
  deriveTitleFromUrl: deriveTitleFromUrlMock,
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: selectMock,
    insert: insertMock,
  },
}))

vi.mock('@/lib/schema', () => ({
  documents: {
    id: 'id',
    title: 'title',
    slug: 'slug',
    content: 'content',
    updatedAt: 'updatedAt',
    workspaceId: 'workspaceId',
    deletedAt: 'deletedAt',
  },
  knowledgeSources: {},
  openapiSources: {
    id: 'id',
    name: 'name',
    sourceType: 'sourceType',
    sourceUrl: 'sourceUrl',
    rawContent: 'rawContent',
    parsedVersion: 'parsedVersion',
    openapiVersion: 'openapiVersion',
    lastSyncedAt: 'lastSyncedAt',
    workspaceId: 'workspaceId',
    deletedAt: 'deletedAt',
  },
}))

describe('POST /api/ai/knowledge-sources', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    withWorkspaceAuthMock.mockResolvedValue({
      ctx: {
        workspaceId: 'ws_123',
        userId: 'user_123',
        role: 'admin',
      },
    })

    insertMock.mockReturnValue({ values: valuesMock })
    valuesMock.mockReturnValue({ returning: returningMock })
    selectMock.mockReturnValue({ from: selectFromMock })
    selectFromMock.mockReturnValue({ where: selectWhereMock })

    parsePublicHttpUrlMock.mockImplementation((value: string) => new URL(value))
    deriveTitleFromUrlMock.mockImplementation((value: string) => {
      if (value.includes('authentication')) return 'authentication'
      if (value.includes('orders')) return 'orders'
      return 'generated'
    })
  })

  it('creates one knowledge source per URL when batch importing URLs', async () => {
    const createdItems = [
      { id: 'source_1', title: 'authentication', sourceUrl: 'https://example.com/docs/authentication' },
      { id: 'source_2', title: 'orders', sourceUrl: 'https://example.com/docs/orders' },
    ]
    returningMock.mockResolvedValue(createdItems)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/ai/knowledge-sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'url',
          sourceUrls: [
            'https://example.com/docs/authentication',
            'https://example.com/docs/orders',
          ],
        }),
      }) as never,
    )

    expect(parsePublicHttpUrlMock).toHaveBeenCalledTimes(2)
    expect(valuesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        workspaceId: 'ws_123',
        createdBy: 'user_123',
        sourceType: 'url',
        sourceUrl: 'https://example.com/docs/authentication',
        title: 'authentication',
        metadata: { generatedTitleFromUrl: true },
      }),
      expect.objectContaining({
        workspaceId: 'ws_123',
        createdBy: 'user_123',
        sourceType: 'url',
        sourceUrl: 'https://example.com/docs/orders',
        title: 'orders',
        metadata: { generatedTitleFromUrl: true },
      }),
    ])

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ items: createdItems })
  })

  it('creates one knowledge source per workspace document import', async () => {
    selectWhereMock.mockResolvedValue([
      {
        id: 'doc_1',
        title: 'Authentication Guide',
        slug: 'authentication-guide',
        content: '# Auth\n\nUse an API key.',
        updatedAt: new Date('2026-03-19T09:00:00.000Z'),
      },
      {
        id: 'doc_2',
        title: 'Webhook Guide',
        slug: 'webhook-guide',
        content: '# Webhooks\n\nVerify signatures.',
        updatedAt: new Date('2026-03-19T09:05:00.000Z'),
      },
    ])
    const createdItems = [
      { id: 'source_1', title: 'Authentication Guide' },
      { id: 'source_2', title: 'Webhook Guide' },
    ]
    returningMock
      .mockResolvedValueOnce([createdItems[0]])
      .mockResolvedValueOnce([createdItems[1]])

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/ai/knowledge-sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'document',
          sourceOrigin: 'workspace',
          workspaceImportIds: ['doc_1', 'doc_2'],
        }),
      }) as never,
    )

    expect(selectMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledTimes(2)
    expect(valuesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workspaceId: 'ws_123',
        createdBy: 'user_123',
        sourceType: 'document',
        title: 'Authentication Guide',
        rawContent: '# Auth\n\nUse an API key.',
        metadata: {
          generatedTitleFromWorkspace: true,
          workspaceImport: {
            kind: 'document',
            documentId: 'doc_1',
            slug: 'authentication-guide',
            updatedAt: '2026-03-19T09:00:00.000Z',
          },
        },
      }),
    )
    expect(valuesMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workspaceId: 'ws_123',
        createdBy: 'user_123',
        sourceType: 'document',
        title: 'Webhook Guide',
        rawContent: '# Webhooks\n\nVerify signatures.',
        metadata: {
          generatedTitleFromWorkspace: true,
          workspaceImport: {
            kind: 'document',
            documentId: 'doc_2',
            slug: 'webhook-guide',
            updatedAt: '2026-03-19T09:05:00.000Z',
          },
        },
      }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ items: createdItems })
  })

  it('rejects URL batch requests without any URLs', async () => {
    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/ai/knowledge-sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'url',
          sourceUrls: [],
        }),
      }) as never,
    )

    expect(insertMock).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'At least one URL is required',
    })
  })

  it('rejects workspace imports without any selected items', async () => {
    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/ai/knowledge-sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'document',
          sourceOrigin: 'workspace',
          workspaceImportIds: [],
        }),
      }) as never,
    )

    expect(insertMock).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Select at least one workspace item to import',
    })
  })
})
