import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai-server', () => ({
  requestAiTextCompletion: vi.fn(),
}))

vi.mock('@/lib/server-errors', () => ({
  logServerError: vi.fn(),
}))

vi.mock('@/lib/chunker', () => ({
  estimateTokens: (text: string) => Math.ceil(text.length / 4),
}))

import {
  parseExtractionResponse,
  normalizeEntityName,
  _ENTITY_EXTRACTION_SYSTEM_PROMPT,
} from '../kg/entity-extraction'
import { mergeSourceIds, mergeEntityDescriptions } from '../kg/entity-merging'

describe('parseExtractionResponse', () => {
  it('parses well-formatted entities and relations', () => {
    const response = `ENTITY|OrderInput|schema|Input type for creating orders
ENTITY|/orders|endpoint|Endpoint to create and list orders
RELATION|OrderInput|/orders|OrderInput is the request body for /orders|request body, input`

    const result = parseExtractionResponse(response)
    expect(result.entities).toHaveLength(2)
    expect(result.entities[0]).toEqual({
      name: 'OrderInput',
      entityType: 'schema',
      description: 'Input type for creating orders',
    })
    expect(result.entities[1]).toEqual({
      name: '/orders',
      entityType: 'endpoint',
      description: 'Endpoint to create and list orders',
    })
    expect(result.relations).toHaveLength(1)
    expect(result.relations[0]).toEqual({
      sourceEntity: '/orders',
      targetEntity: 'OrderInput',
      description: 'OrderInput is the request body for /orders',
      keywords: 'request body, input',
    })
  })

  it('normalizes unknown entity types to other', () => {
    const response = `ENTITY|Foo|unknown_type|A foo entity`
    const result = parseExtractionResponse(response)
    expect(result.entities[0].entityType).toBe('other')
  })

  it('handles entity types with spaces', () => {
    const response = `ENTITY|E1|error code|An error code entity`
    const result = parseExtractionResponse(response)
    expect(result.entities[0].entityType).toBe('error_code')
  })

  it('deduplicates entities by case-insensitive name', () => {
    const response = `ENTITY|MetaObject|schema|First description
ENTITY|metaobject|schema|Second description`

    const result = parseExtractionResponse(response)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('MetaObject')
  })

  it('deduplicates relations by normalized pair', () => {
    const response = `RELATION|A|B|First relation|keyword1
RELATION|B|A|Duplicate relation|keyword2`

    const result = parseExtractionResponse(response)
    expect(result.relations).toHaveLength(1)
  })

  it('normalizes relation direction alphabetically', () => {
    const response = `RELATION|Zebra|Alpha|Z depends on A|dependency`
    const result = parseExtractionResponse(response)
    expect(result.relations[0].sourceEntity).toBe('Alpha')
    expect(result.relations[0].targetEntity).toBe('Zebra')
  })

  it('skips entities with names exceeding 200 characters', () => {
    const longName = 'x'.repeat(201)
    const response = `ENTITY|${longName}|schema|Too long
ENTITY|Valid|schema|Valid entity`

    const result = parseExtractionResponse(response)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Valid')
  })

  it('skips entities with empty names', () => {
    const response = `ENTITY||schema|No name`
    const result = parseExtractionResponse(response)
    expect(result.entities).toHaveLength(0)
  })

  it('skips malformed lines (not enough parts)', () => {
    const response = `ENTITY|OnlyTwoParts
RELATION|OnlyThree|Parts|Desc
ENTITY|Valid|schema|Valid entity`

    const result = parseExtractionResponse(response)
    expect(result.entities).toHaveLength(1)
    expect(result.relations).toHaveLength(0)
  })

  it('handles blank lines and extra whitespace', () => {
    const response = `
  ENTITY|  Foo  |  schema  |  A foo  

  RELATION|  Foo  |  Bar  |  desc  |  kw  
`
    const result = parseExtractionResponse(response)
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Foo')
    expect(result.entities[0].description).toBe('A foo')
    expect(result.relations).toHaveLength(1)
  })

  it('returns empty for completely malformed input', () => {
    const result = parseExtractionResponse('This has nothing useful')
    expect(result.entities).toEqual([])
    expect(result.relations).toEqual([])
  })

  it('returns empty for empty input', () => {
    const result = parseExtractionResponse('')
    expect(result.entities).toEqual([])
    expect(result.relations).toEqual([])
  })

  it('caps entities at 50', () => {
    const lines = Array.from({ length: 60 }, (_, i) => `ENTITY|E${i}|schema|Entity ${i}`)
    const result = parseExtractionResponse(lines.join('\n'))
    expect(result.entities).toHaveLength(50)
  })

  it('caps relations at 50', () => {
    const lines = Array.from(
      { length: 60 },
      (_, i) => `RELATION|Src${i}|Tgt${i}|Rel ${i}|kw`,
    )
    const result = parseExtractionResponse(lines.join('\n'))
    expect(result.relations).toHaveLength(50)
  })

  it('preserves pipe characters in description (joined from extra parts)', () => {
    const response = `ENTITY|Foo|schema|Description with|pipe|characters`
    const result = parseExtractionResponse(response)
    expect(result.entities[0].description).toBe('Description with|pipe|characters')
  })

  it('skips relations with empty source or target', () => {
    const response = `RELATION||Target|desc|kw
RELATION|Source||desc|kw`
    const result = parseExtractionResponse(response)
    expect(result.relations).toHaveLength(0)
  })
})

describe('normalizeEntityName', () => {
  it('lowercases and trims', () => {
    expect(normalizeEntityName('  MetaObject  ')).toBe('metaobject')
  })

  it('replaces spaces, underscores, and hyphens with underscore', () => {
    expect(normalizeEntityName('error code')).toBe('error_code')
    expect(normalizeEntityName('error-code')).toBe('error_code')
    expect(normalizeEntityName('error_code')).toBe('error_code')
  })

  it('collapses multiple separators', () => {
    expect(normalizeEntityName('foo  - _bar')).toBe('foo_bar')
  })

  it('removes special characters', () => {
    expect(normalizeEntityName('/orders/{id}')).toBe('ordersid')
  })

  it('preserves CJK characters', () => {
    expect(normalizeEntityName('接口定义')).toBe('接口定义')
  })

  it('preserves mixed CJK and alphanumeric', () => {
    expect(normalizeEntityName('API接口 v2')).toBe('api接口_v2')
  })

  it('handles empty string', () => {
    expect(normalizeEntityName('')).toBe('')
  })

  it('handles string with only special chars', () => {
    expect(normalizeEntityName('!@#$%')).toBe('')
  })
})

describe('mergeSourceIds', () => {
  it('merges two semicolon-separated lists', () => {
    expect(mergeSourceIds('a;b', 'c;d')).toBe('a;b;c;d')
  })

  it('deduplicates IDs', () => {
    expect(mergeSourceIds('a;b;c', 'b;c;d')).toBe('a;b;c;d')
  })

  it('handles empty existing', () => {
    expect(mergeSourceIds('', 'a;b')).toBe('a;b')
  })

  it('handles empty new IDs', () => {
    expect(mergeSourceIds('a;b', '')).toBe('a;b')
  })

  it('handles both empty', () => {
    expect(mergeSourceIds('', '')).toBe('')
  })

  it('respects maxIds limit (keeps most recent)', () => {
    const existing = Array.from({ length: 5 }, (_, i) => `old${i}`).join(';')
    const newIds = Array.from({ length: 5 }, (_, i) => `new${i}`).join(';')
    const result = mergeSourceIds(existing, newIds, 7)
    const ids = result.split(';')
    expect(ids).toHaveLength(7)
    // Should keep the last 7 items (FIFO: drops earliest)
    expect(ids).toContain('new4')
    expect(ids).toContain('new0')
  })

  it('handles single IDs', () => {
    expect(mergeSourceIds('a', 'b')).toBe('a;b')
  })
})

describe('ENTITY_EXTRACTION_SYSTEM_PROMPT', () => {
  it('is a non-empty string containing entity type references', () => {
    expect(_ENTITY_EXTRACTION_SYSTEM_PROMPT).toBeTruthy()
    expect(_ENTITY_EXTRACTION_SYSTEM_PROMPT).toContain('endpoint')
    expect(_ENTITY_EXTRACTION_SYSTEM_PROMPT).toContain('ENTITY')
    expect(_ENTITY_EXTRACTION_SYSTEM_PROMPT).toContain('RELATION')
  })
})

describe('mergeEntityDescriptions', () => {
  it('returns existing when new is empty', async () => {
    const result = await mergeEntityDescriptions({
      workspaceId: 'ws_test',
      existingDescription: 'Existing desc',
      newDescription: '',
      entityName: 'Foo',
      existingMentionCount: 1,
    })
    expect(result).toBe('Existing desc')
  })

  it('returns new when existing is empty', async () => {
    const result = await mergeEntityDescriptions({
      workspaceId: 'ws_test',
      existingDescription: '',
      newDescription: 'New desc',
      entityName: 'Foo',
      existingMentionCount: 0,
    })
    expect(result).toBe('New desc')
  })

  it('concatenates descriptions below threshold', async () => {
    const result = await mergeEntityDescriptions({
      workspaceId: 'ws_test',
      existingDescription: 'First description',
      newDescription: 'Second description',
      entityName: 'Foo',
      existingMentionCount: 2,
    })
    expect(result).toBe('First description\n---\nSecond description')
  })

  it('truncates when above threshold without LLM provider', async () => {
    const result = await mergeEntityDescriptions({
      workspaceId: 'ws_test',
      existingDescription: 'A'.repeat(3000),
      newDescription: 'B'.repeat(3000),
      entityName: 'Foo',
      existingMentionCount: 10,
    })
    expect(result.length).toBeLessThanOrEqual(4000)
  })
})
