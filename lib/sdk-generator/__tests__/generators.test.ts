import { describe, expect, it } from 'vitest'
import { generateTypescriptSdk } from '@/lib/sdk-generator/typescript'
import { generatePythonSdk } from '@/lib/sdk-generator/python'
import { generateGoSdk } from '@/lib/sdk-generator/go'
import type { OpenApiDocument } from '@/lib/sdk-generator/shared'

const spec: OpenApiDocument = {
  info: {
    title: 'Pet Store',
  },
  servers: [
    {
      url: 'https://api.example.com',
    },
  ],
  components: {
    schemas: {
      Owner: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/pets/{pet-id}': {
      get: {
        operationId: 'getPet',
        tags: ['pets'],
        parameters: [
          { name: 'pet-id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'verbose', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['id', 'metadata'],
                  properties: {
                    id: { type: 'string' },
                    owner: { $ref: '#/components/schemas/Owner' },
                    metadata: {
                      type: 'object',
                      required: ['visits'],
                      properties: {
                        visits: { type: 'integer' },
                        labels: {
                          type: 'object',
                          additionalProperties: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: 'createPet',
        tags: ['pets'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'details'],
                properties: {
                  name: { type: 'string' },
                  details: {
                    type: 'object',
                    required: ['age'],
                    properties: {
                      age: { type: 'integer' },
                      owner: { $ref: '#/components/schemas/Owner' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Owner' },
              },
            },
          },
        },
      },
    },
  },
}

describe('SDK generators', () => {
  it('imports nested referenced component types in TypeScript endpoint files', () => {
    const files = generateTypescriptSdk(spec, 'pet-sdk', '1.0.0')
    const endpointFile = files.get('src/endpoints/pets.ts')

    expect(endpointFile).toBeTruthy()
    expect(endpointFile).toContain(`import type { Owner } from '../types'`)
    expect(endpointFile).toContain('params["pet-id"]')
    expect(endpointFile).toContain('encodeURIComponent(String(params["pet-id"]))')
  })

  it('emits named Python payload models for inline request and response objects', () => {
    const files = generatePythonSdk(spec, 'pet-sdk', '1.0.0')
    const typesFile = files.get('pet_sdk/types.py')
    const endpointFile = files.get('pet_sdk/endpoints/pets.py')

    expect(typesFile).toBeTruthy()
    expect(endpointFile).toBeTruthy()
    expect(typesFile).toContain('class CreatePetRequest(')
    expect(typesFile).toContain('class CreatePetRequestDetails(')
    expect(typesFile).toContain('class GetPetResponse(')
    expect(typesFile).toContain('class GetPetResponseMetadata(')
    expect(endpointFile).toContain('body: CreatePetRequest')
    expect(endpointFile).toContain(') -> GetPetResponse:')
    expect(endpointFile).toContain('params: Dict[str, str] = {}')
    expect(endpointFile).not.toContain('Dict[str, Any]')
  })

  it('emits named Go payload structs and pointer-based optional query params', () => {
    const files = generateGoSdk(spec, 'pet-sdk', '1.0.0')
    const typesFile = files.get('types.go')
    const endpointFile = files.get('endpoints.go')

    expect(typesFile).toBeTruthy()
    expect(endpointFile).toBeTruthy()
    expect(typesFile).toContain('type CreatePetRequest struct {')
    expect(typesFile).toContain('type CreatePetRequestDetails struct {')
    expect(typesFile).toContain('type GetPetResponse struct {')
    expect(typesFile).toContain('type GetPetResponseMetadata struct {')
    expect(typesFile).toContain('Labels map[string]string')
    expect(endpointFile).toContain('func (c *Client) GetPet(petId string, verbose *bool) (GetPetResponse, error)')
    expect(endpointFile).toContain('query.Set("verbose", fmt.Sprint(*verbose))')
    expect(endpointFile).not.toContain('map[string]interface{}')
  })
})
