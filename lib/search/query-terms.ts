const DEFAULT_MAX_QUERY_TERMS = 24
const DEFAULT_MAX_PRIMARY_QUERY_TERMS = 10
const DEFAULT_MAX_SECONDARY_QUERY_TERMS = 12
const MAX_CJK_GRAM_LENGTH = 4
const CJK_INTENT_PREFIXES = [
  '如何',
  '怎么',
  '请问',
  '关于',
  '有关',
  '帮我',
  '协助',
  '查看',
  '查询',
  '获取',
  '了解',
  '说明',
  '介绍',
  '讲解',
  '配置',
  '设置',
  '是否',
  '可以',
  '支持',
  '使用',
]

export function containsCjk(text: string) {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/.test(text)
}

function compactTerm(value: string) {
  return value.replace(/[\s_-]+/g, '')
}

function trimCjkIntentPrefix(token: string) {
  let current = token
  let changed = true

  while (changed) {
    changed = false
    for (const prefix of CJK_INTENT_PREFIXES) {
      if (current.startsWith(prefix) && current.length - prefix.length >= 2) {
        current = current.slice(prefix.length)
        changed = true
        break
      }
    }
  }

  return current
}

function buildCjkQueryTerms(token: string) {
  const variants: string[] = []
  const seen = new Set<string>()

  const addVariant = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    variants.push(trimmed)
  }

  const trimmedToken = trimCjkIntentPrefix(token)
  if (trimmedToken !== token) {
    addVariant(trimmedToken)
  }

  const gramSource = trimmedToken.length >= 2 ? trimmedToken : token
  const maxGramLength = Math.min(MAX_CJK_GRAM_LENGTH, gramSource.length - 1)

  for (let size = 2; size <= maxGramLength; size += 1) {
    for (let start = 0; start + size <= gramSource.length; start += 1) {
      addVariant(gramSource.slice(start, start + size))
    }
  }

  return variants
}

export function extractQueryTerms(
  query: string,
  options: {
    maxTerms?: number
  } = {},
) {
  const normalized = query.trim()
  if (!normalized) return []

  const maxTerms = options.maxTerms ?? DEFAULT_MAX_QUERY_TERMS
  const seen = new Set<string>()
  const terms: string[] = []

  const addTerm = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const key = trimmed.toLowerCase()
    if (seen.has(key)) return

    seen.add(key)
    terms.push(trimmed)
  }

  addTerm(normalized)
  addTerm(normalized.replace(/[_-]+/g, ' '))
  addTerm(normalized.replace(/[\s_-]+/g, ''))

  for (const token of normalized.match(/[A-Za-z][A-Za-z0-9:_-]{2,}/g) ?? []) {
    addTerm(token)
    addTerm(token.replace(/[_-]+/g, ' '))
    addTerm(token.replace(/[\s_-]+/g, ''))
    addTerm(token.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
  }

  for (const token of normalized.match(/[\u3400-\u4dbf\u4e00-\u9fff]{2,}/g) ?? []) {
    addTerm(token)
    for (const variant of buildCjkQueryTerms(token)) {
      addTerm(variant)
    }
  }

  return terms.slice(0, maxTerms)
}

function isPrimaryQueryTerm(term: string, queryHasCjk: boolean) {
  const compact = compactTerm(term)
  if (!compact) return false

  if (queryHasCjk || containsCjk(term)) {
    return compact.length >= 3
  }

  if (/[A-Za-z]/.test(term)) {
    return compact.length >= 4 || /[/:]/.test(term)
  }

  return compact.length >= 3
}

export interface QueryMatchPlan {
  normalizedQuery: string
  exactTerms: string[]
  primaryTerms: string[]
  secondaryTerms: string[]
  previewTerms: string[]
}

export function createQueryMatchPlan(
  query: string,
  options: {
    maxPrimaryTerms?: number
    maxSecondaryTerms?: number
    maxTerms?: number
  } = {},
): QueryMatchPlan {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return {
      normalizedQuery: '',
      exactTerms: [],
      primaryTerms: [],
      secondaryTerms: [],
      previewTerms: [],
    }
  }

  const maxPrimaryTerms = options.maxPrimaryTerms ?? DEFAULT_MAX_PRIMARY_QUERY_TERMS
  const maxSecondaryTerms = options.maxSecondaryTerms ?? DEFAULT_MAX_SECONDARY_QUERY_TERMS
  const extractedTerms = extractQueryTerms(normalizedQuery, {
    maxTerms: options.maxTerms,
  })
  const queryHasCjk = containsCjk(normalizedQuery)

  const exactTerms: string[] = []
  const primaryTerms: string[] = []
  const secondaryTerms: string[] = []
  const exactSeen = new Set<string>()
  const primarySeen = new Set<string>()
  const secondarySeen = new Set<string>()

  const addExactTerm = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const key = trimmed.toLowerCase()
    if (exactSeen.has(key)) return
    exactSeen.add(key)
    exactTerms.push(trimmed)
  }

  const addPrimaryTerm = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const key = trimmed.toLowerCase()
    if (primarySeen.has(key)) return
    primarySeen.add(key)
    primaryTerms.push(trimmed)
  }

  const addSecondaryTerm = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const key = trimmed.toLowerCase()
    if (primarySeen.has(key) || secondarySeen.has(key)) return
    secondarySeen.add(key)
    secondaryTerms.push(trimmed)
  }

  addExactTerm(normalizedQuery)
  const compactQuery = compactTerm(normalizedQuery)
  if (compactQuery && compactQuery.toLowerCase() !== normalizedQuery.toLowerCase()) {
    addExactTerm(compactQuery)
  }

  for (const term of exactTerms) {
    addPrimaryTerm(term)
  }

  for (const term of extractedTerms) {
    if (isPrimaryQueryTerm(term, queryHasCjk)) {
      addPrimaryTerm(term)
    } else {
      addSecondaryTerm(term)
    }
  }

  if (primaryTerms.length === 0) {
    for (const term of extractedTerms.slice(0, maxPrimaryTerms)) {
      addPrimaryTerm(term)
    }
  }

  for (const term of extractedTerms) {
    addSecondaryTerm(term)
  }

  const boundedPrimaryTerms = primaryTerms.slice(0, maxPrimaryTerms)
  const boundedSecondaryTerms = secondaryTerms.slice(0, maxSecondaryTerms)

  return {
    normalizedQuery,
    exactTerms,
    primaryTerms: boundedPrimaryTerms,
    secondaryTerms: boundedSecondaryTerms,
    previewTerms: [...boundedPrimaryTerms, ...boundedSecondaryTerms],
  }
}
