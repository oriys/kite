import type { ParsedEndpoint } from './parser'

export type OpenApiDocumentType = 'guide' | 'best-practice' | 'api-reference'

interface OpenApiDocumentTypeMeta {
  value: OpenApiDocumentType
  label: string
  description: string
  category: string
  titleSuffix: string
  aiInstructions: string[]
}

export const OPENAPI_DOCUMENT_TYPE_OPTIONS: OpenApiDocumentTypeMeta[] = [
  {
    value: 'guide',
    label: 'Guide document',
    description:
      'Explain a workflow or onboarding path using the selected endpoints.',
    category: 'Guide',
    titleSuffix: 'guide',
    aiInstructions: [
      'Write for someone trying to complete a workflow, not just inspect raw API fields.',
      'Organize the content into a guided narrative with sequence, prerequisites, and practical checkpoints.',
      'Explain how the selected endpoints work together across a single use case or operational flow.',
    ],
  },
  {
    value: 'best-practice',
    label: 'Best practice',
    description:
      'Summarize recommended patterns, trade-offs, and operational guidance.',
    category: 'Best Practice',
    titleSuffix: 'best practices',
    aiInstructions: [
      'Emphasize recommended implementation patterns, operational guidance, and common pitfalls.',
      'Turn the endpoint data into concrete do/don’t advice and decision-making guidance.',
      'Call out trade-offs, sequencing choices, and failure prevention strategies clearly.',
    ],
  },
  {
    value: 'api-reference',
    label: 'API reference',
    description:
      'Produce precise technical documentation for one or more endpoints.',
    category: 'API Reference',
    titleSuffix: 'API reference',
    aiInstructions: [
      'Keep the structure closest to technical API reference documentation.',
      'Group shared authentication and common request or response behavior, then document endpoint-specific details clearly.',
      'Stay exact and implementation-oriented rather than narrative or marketing-heavy.',
    ],
  },
] as const

const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  'getting-started': 'Getting Started',
  'api-reference': 'API Reference',
  changelog: 'Changelog',
  'migration-guide': 'Migration Guide',
  tutorial: 'Tutorial',
  troubleshooting: 'Troubleshooting',
  custom: 'Custom',
}

export function isOpenApiDocumentType(
  value: unknown,
): value is OpenApiDocumentType {
  return OPENAPI_DOCUMENT_TYPE_OPTIONS.some((option) => option.value === value)
}

export function getOpenApiDocumentTypeMeta(
  value: OpenApiDocumentType | null | undefined,
) {
  return OPENAPI_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value) ?? null
}

export function getTemplateCategoryLabel(category?: string | null) {
  if (!category) return ''
  return TEMPLATE_CATEGORY_LABELS[category] ?? category
}

export function buildOpenApiDocumentTitle(input: {
  sourceName: string
  endpoints: Array<Pick<ParsedEndpoint, 'method' | 'path' | 'summary'>>
  documentType?: OpenApiDocumentType | null
  prompt?: string | null
  templateName?: string | null
}) {
  const promptTitle = normalizePromptTitle(input.prompt)
  const typeMeta = getOpenApiDocumentTypeMeta(input.documentType)

  if (
    input.endpoints.length === 1 &&
    input.documentType === 'api-reference'
  ) {
    const endpoint = input.endpoints[0]
    return endpoint.summary
      ? `${endpoint.method} ${endpoint.path} — ${endpoint.summary}`
      : `${endpoint.method} ${endpoint.path}`
  }

  if (input.endpoints.length > 1 && typeMeta) {
    return `${input.sourceName} ${typeMeta.titleSuffix}`
  }

  if (typeMeta && !input.templateName && input.endpoints.length === 0 && !promptTitle) {
    return `${input.sourceName} ${typeMeta.titleSuffix}`
  }

  if (
    input.templateName &&
    input.endpoints.length === 0 &&
    !promptTitle
  ) {
    return input.templateName
  }

  if (promptTitle) {
    return promptTitle
  }

  if (typeMeta) {
    return `${input.sourceName} ${typeMeta.titleSuffix}`
  }

  if (input.endpoints.length > 1) {
    return `${input.sourceName} API document`
  }

  if (input.endpoints.length === 1) {
    const endpoint = input.endpoints[0]
    return endpoint.summary
      ? `${endpoint.method} ${endpoint.path} — ${endpoint.summary}`
      : `${endpoint.method} ${endpoint.path}`
  }

  return 'Untitled'
}

function normalizePromptTitle(prompt?: string | null) {
  const trimmed = (prompt ?? '').trim()
  if (!trimmed) return ''

  const singleLine = trimmed.replace(/\s+/g, ' ')
  if (singleLine.length <= 80) return singleLine
  return `${singleLine.slice(0, 77).trimEnd()}…`
}
