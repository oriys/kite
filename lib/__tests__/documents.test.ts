import { describe, expect, it } from 'vitest'

import {
  areDocumentTagsEqual,
  coerceDocumentTagsInput,
  normalizeDocumentTags,
} from '@/lib/documents'

describe('document tag helpers', () => {
  it('normalizes, lowercases, and deduplicates tags', () => {
    expect(normalizeDocumentTags(' Billing, auth,\nAuth , docs ')).toEqual([
      'billing',
      'auth',
      'docs',
    ])
  })

  it('coerces string arrays and rejects invalid payloads', () => {
    expect(coerceDocumentTagsInput(['Billing', 'Auth'])).toEqual(['billing', 'auth'])
    expect(coerceDocumentTagsInput(['valid', 1])).toBeNull()
  })

  it('compares normalized tag collections', () => {
    expect(areDocumentTagsEqual(['Auth', 'Billing'], 'auth, billing')).toBe(true)
    expect(areDocumentTagsEqual(['Auth'], ['billing'])).toBe(false)
  })
})
