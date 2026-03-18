import { parseOpenAPISpec } from '@/lib/openapi/parser'

describe('parseOpenAPISpec', () => {
  it('resolves local component refs for parameters, request bodies, and responses', async () => {
    const spec = {
      openapi: '3.0.3',
      info: {
        title: 'Pets API',
        version: '1.0.0',
      },
      paths: {
        '/pets/{petId}': {
          parameters: [{ $ref: '#/components/parameters/TraceId' }],
          post: {
            operationId: 'createPet',
            parameters: [{ $ref: '#/components/parameters/PetId' }],
            requestBody: { $ref: '#/components/requestBodies/PetInput' },
            responses: {
              '200': { $ref: '#/components/responses/PetResponse' },
            },
          },
        },
      },
      components: {
        parameters: {
          TraceId: {
            name: 'traceId',
            in: 'header',
            required: false,
            schema: {
              type: 'string',
            },
          },
          PetId: {
            name: 'petId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
        },
        requestBodies: {
          PetInput: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PetInput',
                },
              },
            },
          },
        },
        responses: {
          PetResponse: {
            description: 'Pet created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Pet',
                },
              },
            },
          },
        },
        schemas: {
          PetInput: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
          Pet: {
            allOf: [
              {
                $ref: '#/components/schemas/PetInput',
              },
              {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                required: ['id'],
              },
            ],
          },
        },
      },
    }

    const parsed = await parseOpenAPISpec(JSON.stringify(spec))
    const endpoint = parsed.endpoints[0]

    expect(endpoint.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'traceId',
          in: 'header',
          schema: expect.objectContaining({ type: 'string' }),
        }),
        expect.objectContaining({
          name: 'petId',
          in: 'path',
          schema: expect.objectContaining({ type: 'string' }),
        }),
      ]),
    )

    const requestSchema = (
      (
        endpoint.requestBody?.content as Record<string, { schema?: Record<string, unknown> }>
      )?.['application/json']?.schema
    )
    expect(requestSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          name: expect.objectContaining({ type: 'string' }),
        }),
      }),
    )

    const responseSchema = (
      (
        (endpoint.responses['200'] as Record<string, unknown>).content as Record<
          string,
          { schema?: Record<string, unknown> }
        >
      )?.['application/json']?.schema
    )
    expect(responseSchema).toEqual(
      expect.objectContaining({
        allOf: expect.arrayContaining([
          expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              name: expect.objectContaining({ type: 'string' }),
            }),
          }),
          expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              id: expect.objectContaining({ type: 'string' }),
            }),
          }),
        ]),
      }),
    )
  })

  it('inherits top-level security and preserves explicit public overrides', async () => {
    const spec = {
      openapi: '3.0.3',
      info: {
        title: 'Security API',
        version: '1.0.0',
      },
      servers: [{ url: 'https://api.example.com' }],
      security: [{ bearerAuth: [] }],
      paths: {
        '/private': {
          get: {
            responses: {
              '200': {
                description: 'ok',
              },
            },
          },
        },
        '/public': {
          get: {
            security: [],
            responses: {
              '200': {
                description: 'ok',
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    }

    const parsed = await parseOpenAPISpec(JSON.stringify(spec))

    expect(parsed.servers).toEqual([
      {
        url: 'https://api.example.com',
      },
    ])
    expect(parsed.securitySchemes).toEqual(
      expect.objectContaining({
        bearerAuth: expect.objectContaining({
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }),
      }),
    )

    const privateEndpoint = parsed.endpoints.find((endpoint) => endpoint.path === '/private')
    const publicEndpoint = parsed.endpoints.find((endpoint) => endpoint.path === '/public')

    expect(privateEndpoint?.security).toEqual([{ bearerAuth: [] }])
    expect(publicEndpoint?.security).toEqual([])
  })
})
