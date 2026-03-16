import { describe, expect, it } from 'vitest'

import {
  getCliSkillCatalogItem,
  isValidCliSkillSlug,
  listCliSkillCatalog,
} from '@/lib/skill-catalog'

describe('skill catalog', () => {
  it('loads the root skills lock into a sorted catalog', () => {
    const catalog = listCliSkillCatalog()
    const first = catalog.at(0)
    const last = catalog.at(-1)

    expect(catalog.length).toBeGreaterThan(0)
    expect(first && last ? first.slug <= last.slug : false).toBe(true)
  })

  it('finds a known catalog skill', () => {
    expect(getCliSkillCatalogItem('node')).toMatchObject({
      slug: 'node',
      source: 'mcollina/skills',
      sourceType: 'github',
    })
  })

  it('validates CLI skill slugs', () => {
    expect(isValidCliSkillSlug('supabase-postgres-best-practices')).toBe(true)
    expect(isValidCliSkillSlug('../bad-slug')).toBe(false)
    expect(isValidCliSkillSlug('bad_slug')).toBe(false)
  })
})
