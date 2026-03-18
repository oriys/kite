import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/ai-server', () => ({
  requestAiEmbedding: vi.fn(),
  resolveEmbeddingProvider: vi.fn(),
}))
vi.mock('@/lib/server-errors', () => ({
  logServerError: vi.fn(),
}))

import { buildKgContextSections } from '@/lib/kg/kg-retrieval'
import type { KgEntityHit, KgRelationHit } from '@/lib/kg/kg-retrieval'

describe('kg-retrieval: buildKgContextSections', () => {
  it('formats entities within token budget', () => {
    const entities: KgEntityHit[] = [
      { id: 'e1', name: 'MetaObject', entityType: 'schema', description: 'A custom data type', similarity: 0.9, sourceChunkIds: '', sourceDocumentIds: '', mentionCount: 1 },
      { id: 'e2', name: '/orders', entityType: 'endpoint', description: 'Order management endpoint', similarity: 0.8, sourceChunkIds: '', sourceDocumentIds: '', mentionCount: 1 },
    ]

    const result = buildKgContextSections({
      entities,
      relations: [],
      entityTokenBudget: 2000,
      relationTokenBudget: 2000,
    })

    expect(result.entityContext).toContain('MetaObject')
    expect(result.entityContext).toContain('schema')
    expect(result.entityContext).toContain('/orders')
    expect(result.relationContext).toBe('')
  })

  it('formats relations within token budget', () => {
    const relations: KgRelationHit[] = [
      {
        id: 'r1',
        sourceName: 'Order',
        targetName: 'Product',
        sourceEntityId: 'e1',
        targetEntityId: 'e2',
        description: 'An order contains products',
        keywords: 'contains, includes',
        weight: 1.0,
        similarity: 0.85,
        sourceChunkIds: '',
        mentionCount: 1,
      },
    ]

    const result = buildKgContextSections({
      entities: [],
      relations,
      entityTokenBudget: 2000,
      relationTokenBudget: 2000,
    })

    expect(result.entityContext).toBe('')
    expect(result.relationContext).toContain('Order')
    expect(result.relationContext).toContain('Product')
    expect(result.relationContext).toContain('contains')
  })

  it('respects token budget by truncating', () => {
    const longEntities: KgEntityHit[] = Array.from({ length: 50 }, (_, i) => ({
      id: `e${i}`,
      name: `Entity${i}`,
      entityType: 'concept',
      description: 'A'.repeat(200),
      similarity: 0.9 - i * 0.01,
      sourceChunkIds: '',
      sourceDocumentIds: '',
      mentionCount: 1,
    }))

    const result = buildKgContextSections({
      entities: longEntities,
      relations: [],
      entityTokenBudget: 100,
      relationTokenBudget: 100,
    })

    const entityLines = result.entityContext.split('\n').filter(Boolean)
    expect(entityLines.length).toBeLessThan(50)
  })

  it('returns empty strings when inputs are empty', () => {
    const result = buildKgContextSections({
      entities: [],
      relations: [],
      entityTokenBudget: 2000,
      relationTokenBudget: 2000,
    })

    expect(result.entityContext).toBe('')
    expect(result.relationContext).toBe('')
  })
})
