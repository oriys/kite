export const AI_TRANSFORM_ACTIONS = [
  'polish',
  'shorten',
  'expand',
  'translate',
  'explain',
  'review',
  'score',
  'summarize',
  'outline',
  'checklist',
  'custom',
] as const

export const AI_REWRITE_ACTIONS = [
  'polish',
  'shorten',
  'expand',
  'translate',
] as const

export const AI_APPEND_RESULT_ACTIONS = [
  'review',
  'score',
  'summarize',
  'outline',
  'checklist',
] as const

export const AI_PROVIDER_NAME = 'AIHubMix'
export const DEFAULT_AIHUBMIX_MODEL = 'gpt-4o-mini'
export const DEFAULT_AIHUBMIX_BASE_URL = 'https://aihubmix.com/v1'
export const AI_MODEL_PREFERENCES_STORAGE_KEY = 'editorial-ai-model-preferences'
export const AI_MODEL_PREFERENCES_EVENT = 'editorial-ai-model-preferences:change'

export type AiTransformAction = (typeof AI_TRANSFORM_ACTIONS)[number]

export const AI_ACTION_LABELS: Record<AiTransformAction, string> = {
  polish: 'Polish',
  shorten: 'Shorten',
  expand: 'Expand',
  translate: 'Translate',
  explain: 'Explain',
  review: 'Review',
  score: 'Score',
  summarize: 'Summarize',
  outline: 'Outline',
  checklist: 'Checklist',
  custom: 'Custom Prompt',
}

export const MAX_AI_MODEL_ID_LENGTH = 200
export const MAX_AI_CUSTOM_PROMPT_LENGTH = 2_000
export const MAX_AI_TRANSFORM_TEXT_LENGTH = 8_000

export interface AiCatalogModel {
  id: string
  label: string
  provider: string
  description: string
  contextWindow: number | null
  capabilities: string[]
}

export interface AiModelCatalogResponse {
  configured: boolean
  providerName: string
  baseUrl: string
  defaultModelId: string
  fetchedAt: string
  error?: string
  models: AiCatalogModel[]
}

export interface AiModelPreferences {
  activeModelId: string | null
  enabledModelIds: string[]
}

export interface AiTransformRequest {
  action: AiTransformAction
  text: string
  model?: string
  targetLanguage?: string
  systemPrompt?: string
  actionPrompt?: string
  customPrompt?: string
}

export interface AiTransformResponse {
  result: string
  model: string
}

export function isAiRewriteAction(action: AiTransformAction) {
  return AI_REWRITE_ACTIONS.includes(
    action as (typeof AI_REWRITE_ACTIONS)[number],
  )
}

export function isAiAppendResultAction(action: AiTransformAction) {
  return AI_APPEND_RESULT_ACTIONS.includes(
    action as (typeof AI_APPEND_RESULT_ACTIONS)[number],
  )
}

export function formatAiModelLabel(id: string) {
  return id
    .replace(/[_/]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sortAiCatalogModels(
  models: AiCatalogModel[],
  defaultModelId?: string,
) {
  return [...models].sort((left, right) => {
    if (left.id === defaultModelId) return -1
    if (right.id === defaultModelId) return 1

    const providerResult = left.provider.localeCompare(right.provider)
    if (providerResult !== 0) return providerResult

    return left.label.localeCompare(right.label)
  })
}

export function createDefaultAiModelPreferences(
  models: AiCatalogModel[],
  defaultModelId?: string,
): AiModelPreferences {
  const firstAvailableId =
    models.find((model) => model.id === defaultModelId)?.id ?? models[0]?.id ?? null

  return {
    activeModelId: firstAvailableId,
    enabledModelIds: firstAvailableId ? [firstAvailableId] : [],
  }
}

export function sanitizeAiModelPreferences(
  raw: Partial<AiModelPreferences> | null | undefined,
  models: AiCatalogModel[],
): AiModelPreferences {
  const validIds = new Set(models.map((model) => model.id))
  const enabledModelIds = Array.from(
    new Set(
      (raw?.enabledModelIds ?? [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0 && validIds.has(value)),
    ),
  )
  const activeCandidate =
    typeof raw?.activeModelId === 'string' ? raw.activeModelId.trim() : ''

  return {
    activeModelId:
      activeCandidate && enabledModelIds.includes(activeCandidate)
        ? activeCandidate
        : enabledModelIds[0] ?? null,
    enabledModelIds,
  }
}

export function formatAiContextWindow(value: number | null) {
  if (!value || Number.isNaN(value)) return null

  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}M`
  }

  if (value >= 1_000) {
    return `${Math.round(value / 100) / 10}K`
  }

  return String(value)
}
