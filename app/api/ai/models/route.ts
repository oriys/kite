import { NextResponse } from 'next/server'
import {
  AI_PROVIDER_NAME,
  DEFAULT_AIHUBMIX_BASE_URL,
  DEFAULT_AIHUBMIX_MODEL,
  formatAiModelLabel,
  sortAiCatalogModels,
  type AiCatalogModel,
} from '@/lib/ai'
import { withWorkspaceAuth } from '@/lib/api-utils'

interface LegacyModelsResponse {
  data?: unknown[]
  error?: {
    message?: string
  }
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const nextValue = Number(value)
    return Number.isFinite(nextValue) ? nextValue : null
  }

  return null
}

function getStringArray(...values: unknown[]) {
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

function inferCapabilities(raw: Record<string, unknown>, id: string) {
  const haystack = [
    id,
    getString(raw.desc),
    getString(raw.description),
    getString(raw.category),
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

function normalizeModel(raw: unknown): AiCatalogModel | null {
  if (!raw || typeof raw !== 'object') return null

  const model = raw as Record<string, unknown>
  const id = getString(model.id) || getString(model.model_id)
  if (!id) return null

  const label =
    getString(model.name) ||
    getString(model.display_name) ||
    formatAiModelLabel(id)

  const description =
    getString(model.desc) ||
    getString(model.description) ||
    'Available through the workspace AI provider.'

  return {
    id,
    label,
    provider:
      getString(model.owned_by) ||
      getString(model.provider) ||
      getString(model.vendor) ||
      AI_PROVIDER_NAME,
    description,
    contextWindow:
      getNumber(model.context_window) ??
      getNumber(model.context_length) ??
      getNumber(model.max_tokens) ??
      getNumber(model.max_input_tokens) ??
      getNumber(model.max_output_tokens) ??
      null,
    capabilities: inferCapabilities(model, id),
  }
}

function createFallbackModel(defaultModelId: string): AiCatalogModel {
  return {
    id: defaultModelId,
    label: formatAiModelLabel(defaultModelId),
    provider: AI_PROVIDER_NAME,
    description: 'Configured as the workspace default model.',
    contextWindow: null,
    capabilities: [],
  }
}

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const apiKey =
    process.env.AIHUBMIX_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  const baseUrl = (
    process.env.AIHUBMIX_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    DEFAULT_AIHUBMIX_BASE_URL
  ).replace(/\/$/, '')
  const defaultModelId =
    process.env.AIHUBMIX_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_AIHUBMIX_MODEL

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      providerName: AI_PROVIDER_NAME,
      baseUrl,
      defaultModelId,
      fetchedAt: new Date().toISOString(),
      error: 'AIHUBMIX_API_KEY is not configured on the server.',
      models: [createFallbackModel(defaultModelId)],
    })
  }

  try {
    const upstream = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    const payload =
      (await upstream.json().catch(() => null)) as LegacyModelsResponse | null

    if (!upstream.ok) {
      return NextResponse.json({
        configured: true,
        providerName: AI_PROVIDER_NAME,
        baseUrl,
        defaultModelId,
        fetchedAt: new Date().toISOString(),
        error:
          payload?.error?.message ??
          'The AI provider did not return a model catalog.',
        models: [createFallbackModel(defaultModelId)],
      })
    }

    const models = Array.from(
      new Map(
        (Array.isArray(payload?.data) ? payload.data : [])
          .map((entry) => normalizeModel(entry))
          .filter((entry): entry is AiCatalogModel => entry !== null)
          .map((entry) => [entry.id, entry]),
      ).values(),
    )

    const normalizedModels =
      models.length > 0
        ? sortAiCatalogModels(models, defaultModelId)
        : [createFallbackModel(defaultModelId)]

    return NextResponse.json({
      configured: true,
      providerName: AI_PROVIDER_NAME,
      baseUrl,
      defaultModelId,
      fetchedAt: new Date().toISOString(),
      models: normalizedModels,
    })
  } catch {
    return NextResponse.json({
      configured: true,
      providerName: AI_PROVIDER_NAME,
      baseUrl,
      defaultModelId,
      fetchedAt: new Date().toISOString(),
      error: 'Unable to reach the AI provider right now.',
      models: [createFallbackModel(defaultModelId)],
    })
  }
}
