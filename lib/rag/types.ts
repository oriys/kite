export const RAG_QUERY_MODES = [
  'hybrid',
  'mix',
  'local',
  'global',
  'naive',
] as const

export type RagQueryMode = (typeof RAG_QUERY_MODES)[number]

export type RagVisibilityRole = 'owner' | 'admin' | 'member' | 'guest'

export interface RagVisibilityContext {
  userId: string
  role: RagVisibilityRole
}

export const DEFAULT_RAG_QUERY_MODE: RagQueryMode = 'hybrid'

export function isRagQueryMode(value: string): value is RagQueryMode {
  return RAG_QUERY_MODES.includes(value as RagQueryMode)
}

export function normalizeRagQueryMode(
  value: unknown,
  fallback: RagQueryMode = DEFAULT_RAG_QUERY_MODE,
): RagQueryMode {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  return isRagQueryMode(normalized) ? normalized : fallback
}

export const RAG_QUERY_MODE_OPTIONS: ReadonlyArray<{
  value: RagQueryMode
  label: string
  description: string
}> = [
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Use the full retrieval stack: KG, semantic chunks, keyword matches, and related docs.',
  },
  {
    value: 'mix',
    label: 'Mix',
    description: 'Blend KG grounding with semantic chunks, but skip extra related-document expansion.',
  },
  {
    value: 'local',
    label: 'Local',
    description: 'Bias retrieval toward concrete entities, identifiers, endpoints, and nearby chunks.',
  },
  {
    value: 'global',
    label: 'Global',
    description: 'Bias retrieval toward cross-document relationships, concepts, and broader graph context.',
  },
  {
    value: 'naive',
    label: 'Naive',
    description: 'Use lightweight chunk retrieval without KG expansion or advanced related-doc passes.',
  },
]
