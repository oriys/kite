import { describe, it, expect } from 'vitest'
import { parsePagination } from '../pagination'

function params(obj: Record<string, string>) {
  return new URLSearchParams(obj)
}

describe('parsePagination', () => {
  describe('limit/offset style', () => {
    it('parses limit and offset', () => {
      expect(parsePagination(params({ limit: '10', offset: '20' }))).toEqual({ limit: 10, offset: 20 })
    })

    it('uses default limit when not provided', () => {
      expect(parsePagination(params({ offset: '0' }))).toEqual({ limit: 30, offset: 0 })
    })

    it('caps limit at max', () => {
      expect(parsePagination(params({ limit: '1000' }))).toEqual({ limit: 200, offset: 0 })
    })

    it('respects custom maxLimit', () => {
      expect(parsePagination(params({ limit: '150' }), { maxLimit: 100 })).toEqual({ limit: 100, offset: 0 })
    })

    it('clamps negative offset to 0', () => {
      expect(parsePagination(params({ limit: '10', offset: '-5' }))).toEqual({ limit: 10, offset: 0 })
    })

    it('handles NaN gracefully', () => {
      expect(parsePagination(params({ limit: 'abc', offset: 'xyz' }))).toEqual({ limit: 30, offset: 0 })
    })
  })

  describe('page/pageSize style', () => {
    it('converts page/page_size to limit/offset', () => {
      expect(parsePagination(params({ page: '3', page_size: '10' }))).toEqual({ limit: 10, offset: 20 })
    })

    it('defaults to page 1', () => {
      expect(parsePagination(params({}))).toEqual({ limit: 30, offset: 0 })
    })

    it('supports pageSize camelCase', () => {
      expect(parsePagination(params({ page: '2', pageSize: '15' }))).toEqual({ limit: 15, offset: 15 })
    })

    it('clamps page to minimum 1', () => {
      expect(parsePagination(params({ page: '0' }))).toEqual({ limit: 30, offset: 0 })
    })

    it('caps pageSize at maxLimit', () => {
      expect(parsePagination(params({ page: '1', page_size: '500' }))).toEqual({ limit: 200, offset: 0 })
    })
  })

  describe('precedence', () => {
    it('limit/offset takes priority over page/pageSize', () => {
      expect(parsePagination(params({ limit: '5', offset: '10', page: '3', page_size: '20' })))
        .toEqual({ limit: 5, offset: 10 })
    })
  })

  describe('custom defaults', () => {
    it('uses custom default limit', () => {
      expect(parsePagination(params({}), { limit: 50 })).toEqual({ limit: 50, offset: 0 })
    })
  })
})
