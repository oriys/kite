import { MAX_AI_MODEL_ID_LENGTH } from '@/lib/ai'

export const DOC_AGENT_DEFAULT_MAX_STEPS = 15
export const DOC_AGENT_MIN_MAX_STEPS = 1
export const DOC_AGENT_MAX_MAX_STEPS = 30

export const DOC_AGENT_DEFAULT_TEMPERATURE = 0.2
export const DOC_AGENT_MIN_TEMPERATURE = 0
export const DOC_AGENT_MAX_TEMPERATURE = 1
export const DOC_AGENT_TEMPERATURE_STEP = 0.1

export interface DocAgentRunSettings {
  modelId: string | null
  maxSteps: number
  temperature: number
}

type ParseResult<T> =
  | { value: T; error?: never }
  | { value?: never; error: string }

function roundTemperature(value: number) {
  return Math.round(value * 10) / 10
}

export function createDefaultDocAgentRunSettings(): DocAgentRunSettings {
  return {
    modelId: null,
    maxSteps: DOC_AGENT_DEFAULT_MAX_STEPS,
    temperature: DOC_AGENT_DEFAULT_TEMPERATURE,
  }
}

export function sanitizeDocAgentModelId(value: unknown) {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= MAX_AI_MODEL_ID_LENGTH
    ? normalized
    : null
}

export function sanitizeDocAgentMaxSteps(
  value: unknown,
  fallback = DOC_AGENT_DEFAULT_MAX_STEPS,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(
    DOC_AGENT_MAX_MAX_STEPS,
    Math.max(DOC_AGENT_MIN_MAX_STEPS, Math.round(value)),
  )
}

export function sanitizeDocAgentTemperature(
  value: unknown,
  fallback = DOC_AGENT_DEFAULT_TEMPERATURE,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(
    DOC_AGENT_MAX_TEMPERATURE,
    Math.max(DOC_AGENT_MIN_TEMPERATURE, roundTemperature(value)),
  )
}

export function sanitizeDocAgentRunSettings(
  raw: Partial<DocAgentRunSettings> | null | undefined,
  options?: { availableModelIds?: Iterable<string> },
): DocAgentRunSettings {
  const availableModelIds = new Set(options?.availableModelIds ?? [])
  const modelCandidate = sanitizeDocAgentModelId(raw?.modelId)

  return {
    modelId:
      modelCandidate &&
      (availableModelIds.size === 0 || availableModelIds.has(modelCandidate))
        ? modelCandidate
        : null,
    maxSteps: sanitizeDocAgentMaxSteps(raw?.maxSteps),
    temperature: sanitizeDocAgentTemperature(raw?.temperature),
  }
}

export function parseDocAgentModelId(value: unknown): ParseResult<string | null> {
  if (value === undefined || value === null) {
    return { value: null }
  }

  if (typeof value !== 'string') {
    return { error: 'Model must be a string' }
  }

  const normalized = value.trim()
  if (!normalized) {
    return { value: null }
  }

  if (normalized.length > MAX_AI_MODEL_ID_LENGTH) {
    return { error: 'Model identifier is too long' }
  }

  return { value: normalized }
}

export function parseDocAgentMaxSteps(value: unknown): ParseResult<number> {
  if (value === undefined || value === null) {
    return { value: DOC_AGENT_DEFAULT_MAX_STEPS }
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: 'Max steps must be a number' }
  }

  if (!Number.isInteger(value)) {
    return { error: 'Max steps must be an integer' }
  }

  if (value < DOC_AGENT_MIN_MAX_STEPS || value > DOC_AGENT_MAX_MAX_STEPS) {
    return {
      error: `Max steps must be between ${DOC_AGENT_MIN_MAX_STEPS} and ${DOC_AGENT_MAX_MAX_STEPS}`,
    }
  }

  return { value }
}

export function parseDocAgentTemperature(value: unknown): ParseResult<number> {
  if (value === undefined || value === null) {
    return { value: DOC_AGENT_DEFAULT_TEMPERATURE }
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: 'Temperature must be a number' }
  }

  if (value < DOC_AGENT_MIN_TEMPERATURE || value > DOC_AGENT_MAX_TEMPERATURE) {
    return {
      error: `Temperature must be between ${DOC_AGENT_MIN_TEMPERATURE} and ${DOC_AGENT_MAX_TEMPERATURE}`,
    }
  }

  return { value: roundTemperature(value) }
}
