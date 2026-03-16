import skillsLock from '@/skills-lock.json'

export interface CliSkillCatalogItem {
  slug: string
  name: string
  description: string
  sourceType: 'github' | 'registry'
  source: string
  ref: string | null
  computedHash: string | null
}

const SKILL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function titleCaseSkillSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildCatalogDescription(source: string) {
  return `CLI skill sourced from ${source}.`
}

const cliSkillCatalog: CliSkillCatalogItem[] = Object.entries(skillsLock.skills)
  .flatMap(([slug, entry]) => {
    if (!SKILL_SLUG_PATTERN.test(slug)) {
      return []
    }
    if (entry.sourceType !== 'github' && entry.sourceType !== 'registry') {
      return []
    }

    return [{
      slug,
      name: titleCaseSkillSlug(slug),
      description: buildCatalogDescription(entry.source),
      sourceType: entry.sourceType,
      source: entry.source,
      ref: null,
      computedHash: entry.computedHash ?? null,
    } satisfies CliSkillCatalogItem]
  })
  .sort((left, right) => left.slug.localeCompare(right.slug))

export function isValidCliSkillSlug(slug: string) {
  return SKILL_SLUG_PATTERN.test(slug)
}

export function listCliSkillCatalog() {
  return cliSkillCatalog
}

export function getCliSkillCatalogItem(slug: string) {
  return cliSkillCatalog.find((item) => item.slug === slug) ?? null
}
