import {
  buildOpenApiDocumentUserPrompt,
  buildEndpointDocUserPrompt,
  formatEndpointContext,
} from '@/lib/openapi/doc-prompt'
import type {
  ParsedEndpoint,
  ParsedSecurityScheme,
} from '@/lib/openapi/parser'
import { buildOpenApiDocumentTitle } from '@/lib/openapi/document-types'

describe('OpenAPI doc prompt builder', () => {
  const endpoint: ParsedEndpoint = {
    method: 'POST',
    path: '/orders',
    operationId: 'createOrder',
    summary: '创建订单',
    description: '创建一个新的订单记录。',
    tags: ['Orders', 'Admin'],
    parameters: [
      {
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        description: 'Prevents duplicate submissions.',
        schema: {
          type: 'string',
          format: 'uuid',
        },
      },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
            },
          },
          example: {
            amount: 199,
          },
        },
      },
    },
    responses: {
      '201': {
        description: 'Created',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        },
      },
      '401': {
        description: 'Unauthorized',
      },
      '429': {
        description: 'Too Many Requests',
      },
    },
    deprecated: false,
    security: [{ bearerAuth: [] }],
  }

  const securitySchemes: Record<string, ParsedSecurityScheme> = {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  }

  it('formats auth, example, scenario, and risk context for endpoint docs', () => {
    const context = formatEndpointContext(endpoint, {
      apiTitle: 'Orders API',
      apiVersion: '2026-03',
      servers: [{ url: 'https://api.example.com' }],
      securitySchemes,
    })

    expect(context).toContain('Authentication:')
    expect(context).toContain('bearerAuth: BEARER (JWT) via the Authorization header')
    expect(context).toContain('Example: {')
    expect(context).toContain('Suggested User Scenarios:')
    expect(context).toContain('Integration Risk Hints:')
    expect(context).toContain('Rate limiting can affect bulk or background jobs')
  })

  it('requires the richer endpoint document structure in the user prompt', () => {
    const prompt = buildEndpointDocUserPrompt(endpoint, {
      apiTitle: 'Orders API',
      apiVersion: '2026-03',
      securitySchemes,
    })

    expect(prompt).toContain('## Endpoint Summary')
    expect(prompt).toContain('## Authentication')
    expect(prompt).toContain('## User Scenarios & Examples')
    expect(prompt).toContain('## Risk Notes')
    expect(prompt).toContain('Ground every claim in the provided metadata')
  })

  it('builds a merged document prompt with custom prompt, template, and multiple endpoints', () => {
    const secondEndpoint: ParsedEndpoint = {
      ...endpoint,
      method: 'GET',
      path: '/orders/{orderId}',
      operationId: 'getOrder',
      summary: '查询订单',
      description: '读取订单详情。',
      requestBody: null,
      responses: {
        '200': {
          description: 'OK',
        },
      },
    }

    const prompt = buildOpenApiDocumentUserPrompt({
      sourceName: 'Orders Source',
      apiTitle: 'Orders API',
      apiVersion: '2026-03',
      endpoints: [endpoint, secondEndpoint],
      securitySchemes,
      documentType: 'guide',
      userPrompt: 'Focus on onboarding external integrators.',
      template: {
        name: 'Getting Started Guide',
        description: 'A reusable onboarding structure.',
        category: 'getting-started',
        content: '# Getting Started\n\n## Prerequisites\n\n- API key',
      },
    })

    expect(prompt).toContain('Target document type: Guide document')
    expect(prompt).toContain('<custom_prompt>')
    expect(prompt).toContain('Focus on onboarding external integrators.')
    expect(prompt).toContain('<template_guidance>')
    expect(prompt).toContain('Template Name: Getting Started Guide')
    expect(prompt).toContain('### Endpoint 1')
    expect(prompt).toContain('### Endpoint 2')
    expect(prompt).toContain('Synthesize all selected endpoints into one document')
  })

  it('builds titles for merged OpenAPI documents', () => {
    expect(
      buildOpenApiDocumentTitle({
        sourceName: 'Orders API',
        documentType: 'guide',
        endpoints: [
          {
            method: 'POST',
            path: '/orders',
            summary: '创建订单',
          },
          {
            method: 'GET',
            path: '/orders/{orderId}',
            summary: '查询订单',
          },
        ],
        prompt: '',
        templateName: null,
      }),
    ).toBe('Orders API guide')
  })
})
