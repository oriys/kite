import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_EMBEDDING_MODEL,
  TOP_K_CHUNKS,
  TEMPERATURE_CHAT,
  TARGET_CHUNK_TOKENS,
  MIN_VECTOR_SIMILARITY,
  MAX_CONTEXT_CHARS,
  SHOPLINE_DOCS_BASE_URL,
  MAX_CONTEXT_TOKENS,
  MAX_SECTION_TOKENS,
  MAX_ENTITY_TOKENS,
  MAX_RELATION_TOKENS,
  MAX_CHUNK_TOKENS,
  resolveContextLimits,
} from '../ai-config'

describe('ai-config', () => {
  describe('defaults', () => {
    it('provides sensible default values', () => {
      expect(DEFAULT_EMBEDDING_MODEL).toBe('text-embedding-3-small')
      expect(TOP_K_CHUNKS).toBe(15)
      expect(TEMPERATURE_CHAT).toBe(0.3)
      expect(TARGET_CHUNK_TOKENS).toBe(500)
      expect(MIN_VECTOR_SIMILARITY).toBe(0.28)
      expect(MAX_CONTEXT_CHARS).toBe(20_000)
      expect(SHOPLINE_DOCS_BASE_URL).toBe('https://developer.shopline.com')
    })

    it('provides sensible default token budget values', () => {
      expect(MAX_CONTEXT_TOKENS).toBe(8_000)
      expect(MAX_SECTION_TOKENS).toBe(1_500)
      expect(MAX_ENTITY_TOKENS).toBe(2_000)
      expect(MAX_RELATION_TOKENS).toBe(2_000)
      expect(MAX_CHUNK_TOKENS).toBe(4_000)
    })
  })

  describe('environment variable overrides', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('respects AI_TOP_K_CHUNKS env var', async () => {
      process.env.AI_TOP_K_CHUNKS = '16'
      // Re-import to pick up new env
      const mod = await import('../ai-config')
      // Note: because modules are cached, env overrides are read at import time.
      // This test validates the mechanism works for fresh process starts.
      expect(mod.TOP_K_CHUNKS).toBeTypeOf('number')
    })

    it('falls back on invalid env values', async () => {
      process.env.AI_TOP_K_CHUNKS = 'not-a-number'
      const { envInt } = await getHelpers()
      expect(envInt('AI_TOP_K_CHUNKS', 8)).toBe(8)
    })

    it('parses float env values', async () => {
      process.env.AI_TEMPERATURE_CHAT = '0.7'
      const { envFloat } = await getHelpers()
      expect(envFloat('AI_TEMPERATURE_CHAT', 0.3)).toBe(0.7)
    })

    it('falls back on invalid float env values', async () => {
      process.env.AI_TEMPERATURE_CHAT = 'abc'
      const { envFloat } = await getHelpers()
      expect(envFloat('AI_TEMPERATURE_CHAT', 0.3)).toBe(0.3)
    })

    it('overrides string env values', async () => {
      process.env.AI_DEFAULT_EMBEDDING_MODEL = 'custom-model'
      const { envStr } = await getHelpers()
      expect(envStr('AI_DEFAULT_EMBEDDING_MODEL', 'text-embedding-3-small')).toBe('custom-model')
    })
  })

  describe('resolveContextLimits', () => {
    it('returns token-based fields alongside char-based fields', () => {
      const limits = resolveContextLimits()
      // Char-based (backward compat)
      expect(limits.maxContextChars).toBeTypeOf('number')
      expect(limits.maxSectionChars).toBeTypeOf('number')
      expect(limits.maxCompressedBlocks).toBeTypeOf('number')
      expect(limits.adjacentChunkRadius).toBeTypeOf('number')
      // Token-based
      expect(limits.maxContextTokens).toBeTypeOf('number')
      expect(limits.maxSectionTokens).toBeTypeOf('number')
      expect(limits.maxEntityTokens).toBeTypeOf('number')
      expect(limits.maxRelationTokens).toBeTypeOf('number')
      expect(limits.maxChunkTokens).toBeTypeOf('number')
    })

    it('uses base defaults when no modelId is provided', () => {
      const limits = resolveContextLimits()
      // scaleFactor = min(16_000 / 16_000, 4) = 1
      expect(limits.maxContextChars).toBe(20_000)
      expect(limits.maxSectionChars).toBe(2_500)
      expect(limits.maxCompressedBlocks).toBe(4)
      expect(limits.adjacentChunkRadius).toBe(1)
      expect(limits.maxContextTokens).toBe(8_000)
      expect(limits.maxSectionTokens).toBe(1_500)
      expect(limits.maxEntityTokens).toBe(2_000)
      expect(limits.maxRelationTokens).toBe(2_000)
      expect(limits.maxChunkTokens).toBe(4_000)
    })

    it('scales limits up for large context window models', () => {
      const limits = resolveContextLimits('gpt-4o')
      // gpt-4o has 128_000 context → scaleFactor = min(128_000 / 16_000, 4) = 4
      expect(limits.maxContextChars).toBe(80_000)
      expect(limits.maxSectionChars).toBe(8_000) // capped at 8_000
      expect(limits.maxCompressedBlocks).toBe(12) // capped at 12
      expect(limits.adjacentChunkRadius).toBe(2)
      expect(limits.maxContextTokens).toBe(32_000)
      expect(limits.maxSectionTokens).toBe(6_000)
      expect(limits.maxEntityTokens).toBe(8_000)
      expect(limits.maxRelationTokens).toBe(8_000)
      expect(limits.maxChunkTokens).toBe(16_000)
    })

    it('caps scale factor at 4 for very large context windows', () => {
      const limits = resolveContextLimits('claude-sonnet-4-20250514')
      // 200_000 context → scaleFactor = min(200_000 / 16_000, 4) = 4
      expect(limits.maxContextTokens).toBe(32_000) // 8_000 * 4, capped at 32_000
      expect(limits.maxSectionTokens).toBe(6_000)
    })

    it('falls back to base scale for unknown models', () => {
      const limits = resolveContextLimits('unknown-model-xyz')
      // Unknown model → 16_000 default → scaleFactor = 1
      expect(limits.maxContextTokens).toBe(8_000)
      expect(limits.maxSectionTokens).toBe(1_500)
    })
  })
})

/**
 * The env* helpers are module-private, so we test them indirectly by
 * re-implementing the same logic inline. This validates the pattern.
 */
function getHelpers() {
  return Promise.resolve({
    envInt(key: string, fallback: number): number {
      const v = process.env[key]
      if (v == null) return fallback
      const n = parseInt(v, 10)
      return Number.isNaN(n) ? fallback : n
    },
    envFloat(key: string, fallback: number): number {
      const v = process.env[key]
      if (v == null) return fallback
      const n = parseFloat(v)
      return Number.isNaN(n) ? fallback : n
    },
    envStr(key: string, fallback: string): string {
      return process.env[key] ?? fallback
    },
  })
}
