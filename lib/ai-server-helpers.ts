import {
  createAiModelRef,
  formatAiModelLabel,
  getAiProviderDefaultBaseUrl,
  type AiCatalogModel,
  type AiProviderType,
} from '@/lib/ai'
import type { ResolvedAiProviderConfig } from './ai-server-types'

export function normalizeBaseUrl(providerType: AiProviderType, value: string) {
  const trimmed = value.trim()
  return (trimmed || getAiProviderDefaultBaseUrl(providerType)).replace(/\/$/, '')
}

export function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const nextValue = Number(value)
    return Number.isFinite(nextValue) ? nextValue : null
  }

  return null
}

export function getStringArray(...values: unknown[]) {
  return Array.from(
    new Set(
      values.flatMap((value) =>
        Array.isArray(value)
          ? value
              .map((entry) => getString(entry))
              .filter(Boolean)
          : [],
      ),
    ),
  )
}

export function inferCapabilities(raw: Record<string, unknown>, id: string) {
  const haystack = [
    id,
    getString(raw.desc),
    getString(raw.description),
    getString(raw.category),
    getString(raw.display_name),
  ]
    .join(' ')
    .toLowerCase()

  const inferred = []

  if (haystack.includes('vision') || haystack.includes('multimodal')) {
    inferred.push('Vision')
  }
  if (haystack.includes('reason')) {
    inferred.push('Reasoning')
  }
  if (haystack.includes('embed')) {
    inferred.push('Embeddings')
  }
  if (haystack.includes('image')) {
    inferred.push('Images')
  }
  if (haystack.includes('audio') || haystack.includes('speech')) {
    inferred.push('Audio')
  }

  return getStringArray(raw.features, raw.types, raw.capabilities, inferred)
}

export function createCatalogModel(
  provider: ResolvedAiProviderConfig,
  modelId: string,
  options?: {
    label?: string
    description?: string
    contextWindow?: number | null
    capabilities?: string[]
  },
): AiCatalogModel {
  return {
    id: createAiModelRef(provider.id, modelId),
    modelId,
    label: options?.label || formatAiModelLabel(modelId),
    provider: provider.name,
    providerId: provider.id,
    providerType: provider.providerType,
    description:
      options?.description || 'Available through the workspace AI provider.',
    contextWindow: options?.contextWindow ?? null,
    capabilities: options?.capabilities ?? [],
  }
}

export function createFallbackModel(provider: ResolvedAiProviderConfig) {
  return provider.defaultModelId
    ? createCatalogModel(provider, provider.defaultModelId, {
        description: 'Configured as the provider default model.',
      })
    : null
}

export function normalizeOpenAiModel(
  raw: unknown,
  provider: ResolvedAiProviderConfig,
): AiCatalogModel | null {
  if (!raw || typeof raw !== 'object') return null

  const model = raw as Record<string, unknown>
  const modelId = getString(model.id) || getString(model.model_id)
  if (!modelId) return null

  return createCatalogModel(provider, modelId, {
    label:
      getString(model.name) ||
      getString(model.display_name) ||
      formatAiModelLabel(modelId),
    description:
      getString(model.desc) ||
      getString(model.description) ||
      'Available through the workspace AI provider.',
    contextWindow:
      getNumber(model.context_window) ??
      getNumber(model.context_length) ??
      getNumber(model.max_tokens) ??
      getNumber(model.max_input_tokens) ??
      getNumber(model.max_output_tokens) ??
      null,
    capabilities: inferCapabilities(model, modelId),
  })
}

export function normalizeAnthropicModel(
  raw: unknown,
  provider: ResolvedAiProviderConfig,
): AiCatalogModel | null {
  if (!raw || typeof raw !== 'object') return null

  const model = raw as Record<string, unknown>
  const modelId = getString(model.id)
  if (!modelId) return null

  return createCatalogModel(provider, modelId, {
    label: getString(model.display_name) || formatAiModelLabel(modelId),
    description: 'Available through the Anthropic Messages API.',
    capabilities: inferCapabilities(model, modelId),
  })
}

export function normalizeGeminiModel(
  raw: unknown,
  provider: ResolvedAiProviderConfig,
): AiCatalogModel | null {
  if (!raw || typeof raw !== 'object') return null

  const model = raw as Record<string, unknown>
  const modelId = getString(model.name)
  if (!modelId) return null

  const supportedGenerationMethods = getStringArray(
    model.supportedGenerationMethods,
  )

  if (
    supportedGenerationMethods.length > 0 &&
    !supportedGenerationMethods.includes('generateContent')
  ) {
    return null
  }

  return createCatalogModel(provider, modelId, {
    label:
      getString(model.displayName) ||
      getString(model.display_name) ||
      formatAiModelLabel(modelId.replace(/^models\//, '')),
    description:
      getString(model.description) ||
      'Available through the Google Gemini API.',
    contextWindow:
      getNumber(model.inputTokenLimit) ??
      getNumber(model.outputTokenLimit) ??
      null,
    capabilities: getStringArray(model.supportedGenerationMethods),
  })
}

export function getProviderErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const record = payload as Record<string, unknown>
  const directError = record.error

  if (typeof directError === 'string') {
    return directError
  }

  if (directError && typeof directError === 'object') {
    const nestedMessage = getString((directError as Record<string, unknown>).message)
    if (nestedMessage) return nestedMessage
  }

  const message = getString(record.message)
  return message
}
