import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedEndpoint } from '@/lib/openapi/parser'
import { apiEndpoints, openapiSources } from '@/lib/schema'

const { transactionMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: transactionMock,
  },
}))

import { createOpenapiSource } from '@/lib/queries/openapi'

describe('createOpenapiSource', () => {
  beforeEach(() => {
    transactionMock.mockReset()
  })

  it('persists parsed endpoints alongside the source on initial import', async () => {
    const createdAt = new Date('2026-03-18T00:00:00.000Z')
    const sourceRecord = {
      id: 'source-1',
      workspaceId: 'workspace-1',
      name: 'Pets API',
      sourceType: 'upload' as const,
      sourceUrl: null,
      rawContent: '{}',
      parsedVersion: '1.0.0',
      openapiVersion: '3.0.3',
      checksum: 'checksum-1',
      lastSyncedAt: createdAt,
      createdAt,
      deletedAt: null,
    }

    const insertSourceValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([sourceRecord]),
    })
    const insertEndpointValues = vi.fn().mockResolvedValue(undefined)
    const tx = {
      insert: vi.fn((table: unknown) => {
        if (table === openapiSources) {
          return { values: insertSourceValues }
        }

        if (table === apiEndpoints) {
          return { values: insertEndpointValues }
        }

        throw new Error('Unexpected table insert')
      }),
    }

    transactionMock.mockImplementation(async (callback) => callback(tx))

    const endpoints: ParsedEndpoint[] = [
      {
        path: '/pets',
        method: 'POST',
        operationId: 'createPet',
        summary: 'Create pet',
        description: 'Create a new pet',
        tags: ['Pets'],
        parameters: [
          {
            name: 'traceId',
            in: 'header',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
          },
        },
        deprecated: false,
      },
    ]

    const result = await createOpenapiSource(
      {
        workspaceId: 'workspace-1',
        name: 'Pets API',
        sourceType: 'upload',
        sourceUrl: null,
        rawContent: '{}',
        parsedVersion: '1.0.0',
        openapiVersion: '3.0.3',
        checksum: 'checksum-1',
      },
      endpoints,
    )

    expect(result).toBe(sourceRecord)
    expect(tx.insert).toHaveBeenNthCalledWith(1, openapiSources)
    expect(insertSourceValues).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        name: 'Pets API',
      }),
    )
    expect(tx.insert).toHaveBeenNthCalledWith(2, apiEndpoints)
    expect(insertEndpointValues).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceId: 'source-1',
        path: '/pets',
        method: 'POST',
        operationId: 'createPet',
        requestBody: endpoints[0].requestBody,
        responses: endpoints[0].responses,
      }),
    ])
  })
})
