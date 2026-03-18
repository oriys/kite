import { NextResponse } from 'next/server'

const withWorkspaceAuthMock = vi.fn()
const findOpenApiSourceMock = vi.fn()
const parseOpenAPISpecMock = vi.fn()
const retrieveDocGenerationContextMock = vi.fn()
const generateOpenApiDocumentMock = vi.fn()
const createDocumentMock = vi.fn()
const getTemplateMock = vi.fn()
const incrementTemplateUsageMock = vi.fn()
const logServerErrorMock = vi.fn()

vi.mock('@/lib/api-utils', () => ({
  withWorkspaceAuth: withWorkspaceAuthMock,
  badRequest: (message: string) =>
    NextResponse.json({ error: message }, { status: 400 }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      openapiSources: {
        findFirst: findOpenApiSourceMock,
      },
    },
  },
}))

vi.mock('@/lib/openapi/parser', () => ({
  parseOpenAPISpec: parseOpenAPISpecMock,
}))

vi.mock('@/lib/openapi/doc-generation-rag', () => ({
  retrieveDocGenerationContext: retrieveDocGenerationContextMock,
  isDocGenerationMaterialSourceType: (value: string) =>
    ['markdown', 'document', 'url', 'openapi', 'graphql', 'asyncapi', 'protobuf', 'rst', 'asciidoc', 'csv', 'sql_ddl', 'typescript_defs', 'postman', 'pdf', 'faq', 'zip'].includes(
      value,
    ),
  DocGenerationMaterialError: class DocGenerationMaterialError extends Error {
    status: number

    constructor(message: string, status = 400) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('@/lib/ai-doc-generator', () => ({
  generateOpenApiDocument: generateOpenApiDocumentMock,
}))

vi.mock('@/lib/queries/documents', () => ({
  createDocument: createDocumentMock,
}))

vi.mock('@/lib/queries/templates', () => ({
  getTemplate: getTemplateMock,
  incrementTemplateUsage: incrementTemplateUsageMock,
}))

vi.mock('@/lib/server-errors', () => ({
  logServerError: logServerErrorMock,
}))

describe('POST /api/ai/generate-docs', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    withWorkspaceAuthMock.mockResolvedValue({
      ctx: {
        workspaceId: 'ws_123',
        userId: 'user_123',
        role: 'member',
      },
    })

    findOpenApiSourceMock.mockResolvedValue({
      id: 'source_123',
      name: 'Orders Source',
      rawContent: 'openapi: 3.1.0',
      parsedVersion: '2026-03',
    })

    parseOpenAPISpecMock.mockResolvedValue({
      title: 'Orders API',
      version: '2026-03',
      endpoints: [],
      servers: [],
      securitySchemes: {},
    })

    retrieveDocGenerationContextMock.mockResolvedValue({
      contextText:
        '[1] Release Notes\nSource Type: markdown\n\nUse Idempotency-Key for order creation.',
      materialCount: 1,
      materialTitles: ['Release Notes'],
      queryVariants: ['orders api migration guide'],
      ragMode: 'mix',
      workspaceSourceCount: 2,
    })

    generateOpenApiDocumentMock.mockResolvedValue({
      title: 'Orders API document',
      content: '# Orders API document',
      model: 'mock-model',
    })

    createDocumentMock.mockResolvedValue({
      id: 'doc_123',
    })

    getTemplateMock.mockResolvedValue(null)
    incrementTemplateUsageMock.mockResolvedValue(undefined)
  })

  it('uses AI generation when only RAG materials are provided', async () => {
    const { POST } = await import('./route')

    const request = new Request('http://localhost/api/ai/generate-docs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        openapiSourceId: 'source_123',
        endpointIds: [],
        prompt: '',
        ragEnabled: true,
        ragMode: 'mix',
        multiTurnRag: true,
        materials: [
          {
            title: 'Release Notes',
            sourceType: 'markdown',
            rawContent:
              '# Release Notes\n\nUse Idempotency-Key for order creation requests.',
          },
        ],
      }),
    })

    const response = await POST(request as never)
    const body = await response.json()

    expect(retrieveDocGenerationContextMock).toHaveBeenCalledTimes(1)
    expect(retrieveDocGenerationContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ragMode: 'mix',
        visibility: {
          userId: 'user_123',
          role: 'member',
        },
      }),
    )
    expect(generateOpenApiDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoints: [],
        prompt: '',
        retrievedContext: expect.objectContaining({
          contextText: expect.stringContaining('Idempotency-Key'),
        }),
      }),
    )
    expect(createDocumentMock).toHaveBeenCalledWith(
      'ws_123',
      'Orders API document',
      '# Orders API document',
      'user_123',
      'Documentation generated with retrieval context.',
      expect.any(String),
      expect.arrayContaining(['openapi', 'ai-generated']),
    )
    expect(body).toEqual({
      document: {
        documentId: 'doc_123',
        title: 'Orders API document',
        mode: 'ai',
        retrieval: {
          materialCount: 1,
          materialTitles: ['Release Notes'],
          queryVariants: ['orders api migration guide'],
          ragMode: 'mix',
          workspaceSourceCount: 2,
        },
      },
    })
  })
})
