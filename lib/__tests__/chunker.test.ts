import { describe, it, expect } from 'vitest'
import { chunkDocument, computeContentHash } from '../chunker'

describe('chunker', () => {
  describe('chunkDocument', () => {
    it('returns at least one chunk for non-empty content', () => {
      const chunks = chunkDocument('Test Doc', 'Hello world')
      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks[0].chunkIndex).toBe(0)
    })

    it('each chunk has required fields', () => {
      const chunks = chunkDocument('Title', 'Some content here')
      for (const chunk of chunks) {
        expect(chunk).toHaveProperty('chunkIndex')
        expect(chunk).toHaveProperty('chunkText')
        expect(chunk).toHaveProperty('embeddingText')
        expect(chunk).toHaveProperty('tokenCount')
        expect(chunk.tokenCount).toBeGreaterThan(0)
      }
    })

    it('splits long content into multiple chunks', () => {
      const longContent = Array.from({ length: 200 }, (_, i) =>
        `## Section ${i}\n\nThis is paragraph ${i} with enough text to fill up the chunk. `.repeat(5),
      ).join('\n\n')
      const chunks = chunkDocument('Long Doc', longContent)
      expect(chunks.length).toBeGreaterThan(1)
    })

    it('preserves heading context in chunks', () => {
      const content = [
        '# Main Title',
        '',
        'Introduction paragraph.',
        '',
        '## Section A',
        '',
        'Content for section A.',
        '',
        '## Section B',
        '',
        'Content for section B.',
      ].join('\n')

      const chunks = chunkDocument('Doc', content)
      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks[0].chunkText).toContain('Main Title')
    })

    it('handles CJK content', () => {
      const cjkContent = '# 标题\n\n这是一段中文内容，用于测试分块功能。'.repeat(100)
      const chunks = chunkDocument('中文文档', cjkContent)
      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks[0].tokenCount).toBeGreaterThan(0)
    })

    it('returns empty array for empty content', () => {
      const chunks = chunkDocument('Empty', '')
      expect(chunks).toEqual([])
    })

    it('assigns sequential chunk indices', () => {
      const content = Array.from({ length: 50 }, (_, i) =>
        `## Section ${i}\n\n${'Lorem ipsum dolor sit amet. '.repeat(50)}`,
      ).join('\n\n')
      const chunks = chunkDocument('Indexed', content)
      chunks.forEach((chunk, i) => {
        expect(chunk.chunkIndex).toBe(i)
      })
    })
  })

  describe('computeContentHash', () => {
    it('returns a hex string', () => {
      const hash = computeContentHash('Title', 'Content')
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('returns consistent hashes for same input', () => {
      const h1 = computeContentHash('Title', 'Content')
      const h2 = computeContentHash('Title', 'Content')
      expect(h1).toBe(h2)
    })

    it('returns different hashes for different input', () => {
      const h1 = computeContentHash('Title', 'Content A')
      const h2 = computeContentHash('Title', 'Content B')
      expect(h1).not.toBe(h2)
    })
  })
})
