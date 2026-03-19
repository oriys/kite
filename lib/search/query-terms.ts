const DEFAULT_MAX_QUERY_TERMS = 24
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
