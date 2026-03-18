import { describe, it, expect, vi } from 'vitest'

// Mock external dependencies to avoid database/network side effects
vi.mock('@/lib/ai-server', () => ({
  requestAiTextCompletion: vi.fn(),
  resolveWorkspaceAiProviders: vi.fn().mockResolvedValue([]),
  resolveAiModelSelection: vi.fn().mockReturnValue(null),
}))
vi.mock('@/lib/ai-config', () => ({
  TEMPERATURE_QUERY_REWRITE: 0.0,
}))
vi.mock('@/lib/server-errors', () => ({
  logServerError: vi.fn(),
}))
vi.mock('@/lib/queries/ai', () => ({
  getAiWorkspaceSettings: vi.fn().mockResolvedValue(null),
}))

import {
  _parseKeywordResponse,
  _KEYWORD_EXTRACTION_PROMPT,
  heuristicKeywordExtraction,
} from '../kg/query-keywords'

describe('parseKeywordResponse', () => {
  it('parses a well-formatted LLM response', () => {
    const response = `HIGH_LEVEL: authentication flow, permission model
LOW_LEVEL: AccessScope, write_inventory, POST /orders`

    const result = _parseKeywordResponse(response)
    expect(result.highLevel).toEqual(['authentication flow', 'permission model'])
    expect(result.lowLevel).toEqual(['AccessScope', 'write_inventory', 'POST /orders'])
  })

  it('handles extra whitespace and blank lines', () => {
    const response = `
  HIGH_LEVEL:   data pagination ,  error handling  

  LOW_LEVEL:  MetaObject ,  webhook  
`
    const result = _parseKeywordResponse(response)
    expect(result.highLevel).toEqual(['data pagination', 'error handling'])
    expect(result.lowLevel).toEqual(['MetaObject', 'webhook'])
  })

  it('returns empty arrays for a completely malformed response', () => {
    const result = _parseKeywordResponse('This is not in the expected format at all.')
    expect(result.highLevel).toEqual([])
    expect(result.lowLevel).toEqual([])
  })

  it('handles response with only HIGH_LEVEL', () => {
    const result = _parseKeywordResponse('HIGH_LEVEL: overview, best practices')
    expect(result.highLevel).toEqual(['overview', 'best practices'])
    expect(result.lowLevel).toEqual([])
  })

  it('handles response with only LOW_LEVEL', () => {
    const result = _parseKeywordResponse('LOW_LEVEL: MetaObject, write_inventory')
    expect(result.highLevel).toEqual([])
    expect(result.lowLevel).toEqual(['MetaObject', 'write_inventory'])
  })

  it('caps keywords at 5 per level', () => {
    const response = `HIGH_LEVEL: a, b, c, d, e, f, g
LOW_LEVEL: 1, 2, 3, 4, 5, 6, 7`

    const result = _parseKeywordResponse(response)
    expect(result.highLevel).toHaveLength(5)
    expect(result.lowLevel).toHaveLength(5)
  })

  it('filters out empty keywords from trailing commas', () => {
    const response = `HIGH_LEVEL: auth flow, , ,
LOW_LEVEL: MetaObject, ,`

    const result = _parseKeywordResponse(response)
    expect(result.highLevel).toEqual(['auth flow'])
    expect(result.lowLevel).toEqual(['MetaObject'])
  })

  it('filters out keywords exceeding 100 characters', () => {
    const longKeyword = 'a'.repeat(101)
    const response = `HIGH_LEVEL: valid keyword, ${longKeyword}
LOW_LEVEL: ok`

    const result = _parseKeywordResponse(response)
    expect(result.highLevel).toEqual(['valid keyword'])
    expect(result.lowLevel).toEqual(['ok'])
  })

  it('handles empty string input', () => {
    const result = _parseKeywordResponse('')
    expect(result.highLevel).toEqual([])
    expect(result.lowLevel).toEqual([])
  })
})

describe('heuristicKeywordExtraction', () => {
  it('returns empty arrays for empty query', () => {
    const result = heuristicKeywordExtraction('')
    expect(result.highLevel).toEqual([])
    expect(result.lowLevel).toEqual([])
  })

  it('returns empty arrays for whitespace-only query', () => {
    const result = heuristicKeywordExtraction('   ')
    expect(result.highLevel).toEqual([])
    expect(result.lowLevel).toEqual([])
  })

  it('extracts PascalCase identifiers as low-level', () => {
    const result = heuristicKeywordExtraction('How do I use MetaObject and AccessScope?')
    expect(result.lowLevel).toContain('MetaObject')
    expect(result.lowLevel).toContain('AccessScope')
  })

  it('extracts snake_case identifiers as low-level', () => {
    const result = heuristicKeywordExtraction('What does write_inventory do?')
    expect(result.lowLevel).toContain('write_inventory')
  })

  it('extracts API paths as low-level', () => {
    const result = heuristicKeywordExtraction('How to call /admin/products endpoint?')
    expect(result.lowLevel).toContain('/admin/products')
  })

  it('extracts HTTP method + path as low-level', () => {
    const result = heuristicKeywordExtraction('Send a POST /orders request')
    expect(result.lowLevel).toContain('POST /orders')
  })

  it('extracts conceptual terms as high-level', () => {
    const result = heuristicKeywordExtraction('How to handle authentication and pagination?')
    expect(result.highLevel.some(k => /authentication|auth/i.test(k))).toBe(true)
    expect(result.highLevel.some(k => /pagination/i.test(k))).toBe(true)
  })

  it('uses full query as high-level when no concepts match', () => {
    const result = heuristicKeywordExtraction('something completely unrecognized')
    expect(result.highLevel).toHaveLength(1)
    expect(result.highLevel[0]).toBe('something completely unrecognized')
  })

  it('truncates long queries used as high-level fallback to 80 chars', () => {
    const longQuery = 'x'.repeat(120)
    const result = heuristicKeywordExtraction(longQuery)
    expect(result.highLevel[0]).toHaveLength(80)
  })

  it('handles CJK entity-like terms as low-level', () => {
    const result = heuristicKeywordExtraction('请问接口表型的定义是什么')
    expect(result.lowLevel.some(k => /表型/.test(k))).toBe(true)
  })

  it('handles CJK conceptual queries as high-level', () => {
    const result = heuristicKeywordExtraction('如何设置权限？')
    expect(result.highLevel.some(k => /权限|如何/.test(k))).toBe(true)
  })

  it('deduplicates keywords', () => {
    const result = heuristicKeywordExtraction('MetaObject and MetaObject again')
    const metaCount = result.lowLevel.filter(k => k === 'MetaObject').length
    expect(metaCount).toBeLessThanOrEqual(1)
  })

  it('caps output at 5 keywords per level', () => {
    // Query with many identifiers
    const result = heuristicKeywordExtraction(
      'Use AccessScope MetaObject OrderInput ProductType InventorySchema WebhookEnum CustomerObject'
    )
    expect(result.lowLevel.length).toBeLessThanOrEqual(5)
    expect(result.highLevel.length).toBeLessThanOrEqual(5)
  })
})

describe('KEYWORD_EXTRACTION_PROMPT', () => {
  it('is a non-empty string containing expected markers', () => {
    expect(_KEYWORD_EXTRACTION_PROMPT).toBeTruthy()
    expect(_KEYWORD_EXTRACTION_PROMPT).toContain('HIGH_LEVEL')
    expect(_KEYWORD_EXTRACTION_PROMPT).toContain('LOW_LEVEL')
  })
})
