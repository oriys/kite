import { describe, it, expect } from 'vitest'
import { classifyChangeRisk } from '../risk-classifier'

describe('classifyChangeRisk', () => {
  describe('content change scoring', () => {
    it('scores zero for identical content', () => {
      const result = classifyChangeRisk('hello world', 'hello world')
      expect(result.score).toBe(0)
      expect(result.level).toBe('low')
      expect(result.factors).toHaveLength(0)
    })

    it('scores minor for small changes (<20%)', () => {
      const original = 'a'.repeat(100)
      const changed = 'a'.repeat(110) // 10% change
      const result = classifyChangeRisk(original, changed)
      expect(result.score).toBe(5)
      expect(result.level).toBe('low')
      expect(result.factors[0]).toMatch(/Minor content change/)
    })

    it('scores moderate for 20-50% changes', () => {
      const original = 'a'.repeat(100)
      const changed = 'a'.repeat(135) // 35% change
      const result = classifyChangeRisk(original, changed)
      expect(result.score).toBe(15)
      expect(result.level).toBe('low')
      expect(result.factors[0]).toMatch(/Moderate content change/)
    })

    it('scores major for >50% changes', () => {
      const original = 'a'.repeat(100)
      const changed = 'a'.repeat(200) // 100% change
      const result = classifyChangeRisk(original, changed)
      expect(result.score).toBe(30)
      expect(result.level).toBe('medium')
      expect(result.factors[0]).toMatch(/Major content change/)
    })

    it('treats empty original as 100% change', () => {
      const result = classifyChangeRisk('', 'new content')
      expect(result.score).toBe(30)
      expect(result.factors[0]).toMatch(/Major content change/)
    })

    it('handles content shrinking', () => {
      const original = 'a'.repeat(200)
      const changed = 'a'.repeat(50) // 75% reduction
      const result = classifyChangeRisk(original, changed)
      expect(result.score).toBe(30)
      expect(result.factors[0]).toMatch(/Major content change/)
    })
  })

  describe('downstream dependents', () => {
    it('adds 10 points per dependent (capped at 30)', () => {
      const result = classifyChangeRisk('a', 'a', { hasDownstreamDependents: 2 })
      expect(result.score).toBe(20)
      expect(result.factors).toContain('2 downstream dependent(s)')
    })

    it('caps dependent score at 30', () => {
      const result = classifyChangeRisk('a', 'a', { hasDownstreamDependents: 10 })
      expect(result.score).toBe(30)
    })

    it('ignores zero dependents', () => {
      const result = classifyChangeRisk('a', 'a', { hasDownstreamDependents: 0 })
      expect(result.score).toBe(0)
    })
  })

  describe('API documentation flag', () => {
    it('adds 20 points for API docs', () => {
      const result = classifyChangeRisk('a', 'a', { isApiDoc: true })
      expect(result.score).toBe(20)
      expect(result.factors).toContain('API documentation change')
    })
  })

  describe('translation count', () => {
    it('adds 10 points when translations exist', () => {
      const result = classifyChangeRisk('a', 'a', { translationCount: 3 })
      expect(result.score).toBe(10)
      expect(result.factors[0]).toMatch(/3 translation/)
    })

    it('ignores zero translations', () => {
      const result = classifyChangeRisk('a', 'a', { translationCount: 0 })
      expect(result.score).toBe(0)
    })
  })

  describe('risk level thresholds', () => {
    it('returns low for score < 25', () => {
      const result = classifyChangeRisk('a', 'a', { isApiDoc: true }) // 20
      expect(result.level).toBe('low')
    })

    it('returns medium for score 25-49', () => {
      const result = classifyChangeRisk('a', 'a', {
        isApiDoc: true,
        translationCount: 1,
      }) // 30
      expect(result.level).toBe('medium')
    })

    it('returns high for score >= 50', () => {
      const result = classifyChangeRisk('a', 'a', {
        isApiDoc: true, // 20
        hasDownstreamDependents: 2, // 20
        translationCount: 1, // 10
      })
      expect(result.score).toBe(50)
      expect(result.level).toBe('high')
    })
  })

  describe('combined factors', () => {
    it('accumulates all factors', () => {
      const original = 'a'.repeat(100)
      const changed = 'a'.repeat(200) // major change: 30
      const result = classifyChangeRisk(original, changed, {
        hasDownstreamDependents: 3, // 30
        isApiDoc: true, // 20
        translationCount: 2, // 10
      })
      expect(result.score).toBe(90)
      expect(result.level).toBe('high')
      expect(result.factors).toHaveLength(4)
    })
  })
})
