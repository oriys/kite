export const AI_ACTIONS = {
  polish: { label: 'Polish', mode: 'rewrite' },
  autofix: { label: 'Auto Fix', mode: 'rewrite' },
  shorten: { label: 'Shorten', mode: 'rewrite' },
  expand: { label: 'Expand', mode: 'rewrite' },
  translate: { label: 'Translate', mode: 'rewrite' },
  explain: { label: 'Explain', mode: 'append' },
  diagram: { label: 'Diagram', mode: 'preview' },
  review: { label: 'Review', mode: 'append' },
  score: { label: 'Score', mode: 'append' },
  summarize: { label: 'Summarize', mode: 'append' },
  outline: { label: 'Outline', mode: 'append' },
  checklist: { label: 'Checklist', mode: 'append' },
  custom: { label: 'Custom Prompt', mode: 'custom' },
} as const satisfies Record<
  string,
  { label: string; mode: 'rewrite' | 'append' | 'custom' | 'preview' }
>

export type AiTransformAction = keyof typeof AI_ACTIONS

export const AI_TRANSFORM_ACTIONS = Object.keys(
  AI_ACTIONS,
) as AiTransformAction[]

export const REVIEW_SELECTION_AI_ACTIONS = [
  'explain',
  'diagram',
] as const satisfies readonly AiTransformAction[]

export const REVIEW_DOCUMENT_AI_ACTIONS = [
  'diagram',
  'review',
  'score',
  'summarize',
  'outline',
  'checklist',
] as const satisfies readonly AiTransformAction[]

export const REVIEW_READ_ONLY_AI_ACTIONS = [
  'explain',
  'diagram',
  'review',
  'score',
  'summarize',
  'outline',
  'checklist',
] as const satisfies readonly AiTransformAction[]

export const AI_ACTION_LABELS = Object.fromEntries(
  Object.entries(AI_ACTIONS).map(([key, { label }]) => [key, label]),
) as Record<AiTransformAction, string>

export function isAiRewriteAction(action: AiTransformAction) {
  return AI_ACTIONS[action].mode === 'rewrite'
}

export function isAiAppendResultAction(action: AiTransformAction) {
  return AI_ACTIONS[action].mode === 'append'
}

export function isAiPreviewOnlyAction(action: AiTransformAction) {
  return AI_ACTIONS[action].mode === 'preview'
}

export function isAiDiagramAction(action: AiTransformAction) {
  return action === 'diagram'
}

export const AI_PROVIDER_NAME = 'AIHubMix'
export const DEFAULT_AIHUBMIX_MODEL = 'gpt-4o-mini'
export const DEFAULT_AIHUBMIX_BASE_URL = 'https://aihubmix.com/v1'
export const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1'
export const DEFAULT_GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta'
export const AI_MODEL_PREFERENCES_EVENT = 'editorial-ai-model-preferences:change'

export const AI_PROVIDER_TYPES = [
  'openai_compatible',
  'anthropic',
  'gemini',
] as const

export type AiProviderType = (typeof AI_PROVIDER_TYPES)[number]

export const AI_PROVIDER_TYPE_LABELS: Record<AiProviderType, string> = {
  openai_compatible: 'OpenAI-compatible',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
}

export const AI_PROVIDER_DOCS: Record<AiProviderType, string> = {
  openai_compatible: 'https://docs.aihubmix.com/en',
  anthropic: 'https://platform.claude.com/docs',
  gemini: 'https://ai.google.dev/gemini-api/docs',
}

export const AI_PROVIDER_DEFAULT_BASE_URLS: Record<AiProviderType, string> = {
  openai_compatible: DEFAULT_AIHUBMIX_BASE_URL,
  anthropic: DEFAULT_ANTHROPIC_BASE_URL,
  gemini: DEFAULT_GEMINI_BASE_URL,
}

export const AI_MODEL_REF_SEPARATOR = '::'
export const MAX_AI_MODEL_ID_LENGTH = 200
export const MAX_AI_PROVIDER_NAME_LENGTH = 80
export const MAX_AI_PROVIDER_URL_LENGTH = 500
export const MAX_AI_PROVIDER_API_KEY_LENGTH = 2_000
export const MAX_AI_CUSTOM_PROMPT_LENGTH = 2_000
export const MAX_AI_TRANSFORM_TEXT_LENGTH = 8_000

export interface AiCatalogModel {
  id: string
  modelId: string
  label: string
  provider: string
  providerId: string
  providerType: AiProviderType
  description: string
  contextWindow: number | null
  capabilities: string[]
}

export interface AiProviderSummary {
  id: string
  name: string
  providerType: AiProviderType
  providerLabel: string
  baseUrl: string
  defaultModelId: string
  enabled: boolean
  source: 'database' | 'env'
  modelCount: number
  error?: string
}

export interface AiModelCatalogResponse {
  configured: boolean
  defaultModelId: string
  enabledModelIds: string[]
  fetchedAt: string
  error?: string
  providers: AiProviderSummary[]
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

export interface AiProviderFormValues {
  name: string
  providerType: AiProviderType
  baseUrl: string
  apiKey: string
  defaultModelId: string
  enabled: boolean
}

export interface AiProviderConfigListItem {
  id: string
  name: string
  providerType: AiProviderType
  providerLabel: string
  baseUrl: string
  defaultModelId: string
  enabled: boolean
  hasApiKey: boolean
  apiKeyHint: string | null
  createdAt: string
  updatedAt: string
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
  initialEnabledModelIds?: string[],
): AiModelPreferences {
  const validIds = new Set(models.map((model) => model.id))
  const enabledModelIds = Array.from(
    new Set(
      (initialEnabledModelIds ?? []).filter((value) => validIds.has(value)),
    ),
  )
  const firstAvailableId =
    models.find((model) => model.id === defaultModelId)?.id ??
    enabledModelIds[0] ??
    models[0]?.id ??
    null

  return {
    activeModelId: firstAvailableId,
    enabledModelIds:
      enabledModelIds.length > 0
        ? enabledModelIds
        : firstAvailableId
          ? [firstAvailableId]
          : [],
  }
}

export function sanitizeAiModelPreferences(
  raw: Partial<AiModelPreferences> | null | undefined,
  models: AiCatalogModel[],
) {
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

export function createAiModelRef(providerId: string, modelId: string) {
  const normalizedProviderId = providerId.trim()
  const normalizedModelId = modelId.trim()

  return normalizedProviderId && normalizedModelId
    ? `${normalizedProviderId}${AI_MODEL_REF_SEPARATOR}${normalizedModelId}`
    : ''
}

export function parseAiModelRef(
  value: string,
): { providerId: string; modelId: string } | null {
  const normalized = value.trim()
  const separatorIndex = normalized.indexOf(AI_MODEL_REF_SEPARATOR)

  if (separatorIndex <= 0) {
    return null
  }

  const providerId = normalized.slice(0, separatorIndex).trim()
  const modelId = normalized
    .slice(separatorIndex + AI_MODEL_REF_SEPARATOR.length)
    .trim()

  return providerId && modelId ? { providerId, modelId } : null
}

export function getAiProviderLabel(providerType: AiProviderType) {
  return AI_PROVIDER_TYPE_LABELS[providerType]
}

export function getAiProviderDocsUrl(providerType: AiProviderType) {
  return AI_PROVIDER_DOCS[providerType]
}

export function getAiProviderDefaultBaseUrl(providerType: AiProviderType) {
  return AI_PROVIDER_DEFAULT_BASE_URLS[providerType]
}

export function isAiProviderType(value: string): value is AiProviderType {
  return AI_PROVIDER_TYPES.includes(value as AiProviderType)
}

export function createDefaultAiProviderFormValues(
  providerType: AiProviderType = 'openai_compatible',
): AiProviderFormValues {
  return {
    name: '',
    providerType,
    baseUrl: getAiProviderDefaultBaseUrl(providerType),
    apiKey: '',
    defaultModelId: '',
    enabled: true,
  }
}
