import { AiCompletionError } from './ai-server-types'

const AI_TIMEOUT_PATTERNS = [
  'headers timeout',
  'timeout error',
  'timed out',
  'request timed out',
]

const AI_CONNECTIVITY_PATTERNS = [
  'cannot connect to api',
  'failed to fetch',
  'fetch failed',
  'econnrefused',
  'ehostunreach',
  'enotfound',
  'socket hang up',
  'connection refused',
]

const AI_RATE_LIMIT_PATTERNS = [
  'rate limit',
  'too many requests',
  '429',
]

const AI_AUTH_PATTERNS = [
  'invalid api key',
  'incorrect api key',
  'authentication',
  'unauthorized',
  'forbidden',
  '401',
  '403',
]

type AiProviderErrorKind =
  | 'cancelled'
  | 'timeout'
  | 'connectivity'
  | 'rate_limit'
  | 'authentication'
  | 'generic'

function collectErrorMessages(
  error: unknown,
  seen = new Set<unknown>(),
): string[] {
  if (typeof error === 'string') {
    return error.trim() ? [error.trim()] : []
  }

  if (!error || typeof error !== 'object') {
    return []
  }

  if (seen.has(error)) {
    return []
  }
  seen.add(error)

  const messages: string[] = []
  if (error instanceof Error) {
    const message = error.message.trim()
    if (message) {
      messages.push(message)
    }
  } else if ('message' in error && typeof error.message === 'string') {
    const message = error.message.trim()
    if (message) {
      messages.push(message)
    }
  }

  if ('cause' in error) {
    messages.push(...collectErrorMessages(error.cause, seen))
  }

  return messages
}

function hasMatchingErrorPattern(messages: string[], patterns: string[]) {
  const haystack = messages.join('\n').toLowerCase()
  return patterns.some((pattern) => haystack.includes(pattern))
}

function getErrorStatus(error: unknown) {
  if (error instanceof AiCompletionError) {
    return error.status
  }

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status
  }

  return null
}

export function getNormalizedAiErrorMessages(error: unknown) {
  return Array.from(
    new Set(collectErrorMessages(error).map((message) => message.trim()).filter(Boolean)),
  )
}

export function classifyAiProviderError(error: unknown): AiProviderErrorKind {
  if (
    error instanceof DOMException &&
    error.name === 'TimeoutError'
  ) {
    return 'timeout'
  }

  if (
    error instanceof DOMException &&
    error.name === 'AbortError'
  ) {
    return 'cancelled'
  }

  if (
    error instanceof Error &&
    error.name === 'TimeoutError'
  ) {
    return 'timeout'
  }

  const status = getErrorStatus(error)
  if (status === 429) return 'rate_limit'
  if (status === 401 || status === 403) return 'authentication'

  const messages = getNormalizedAiErrorMessages(error)
  if (hasMatchingErrorPattern(messages, AI_TIMEOUT_PATTERNS)) {
    return 'timeout'
  }

  if (hasMatchingErrorPattern(messages, AI_CONNECTIVITY_PATTERNS)) {
    return 'connectivity'
  }

  if (hasMatchingErrorPattern(messages, AI_RATE_LIMIT_PATTERNS)) {
    return 'rate_limit'
  }

  if (hasMatchingErrorPattern(messages, AI_AUTH_PATTERNS)) {
    return 'authentication'
  }

  return 'generic'
}

export function isRetryableAiProviderError(error: unknown) {
  const kind = classifyAiProviderError(error)
  return kind === 'timeout' || kind === 'connectivity' || kind === 'rate_limit'
}

export function formatAiProviderErrorMessage(
  error: unknown,
  options: {
    operation: string
    service?: string
    fallback?: string
  },
) {
  const kind = classifyAiProviderError(error)
  const service = options.service ?? 'AI service'
  const fallback = options.fallback ?? 'AI service temporarily unavailable'
  const messages = getNormalizedAiErrorMessages(error)

  if (kind === 'cancelled') {
    return `${options.operation} was cancelled.`
  }

  if (kind === 'timeout') {
    return `${options.operation} timed out while contacting the provider.`
  }

  if (kind === 'connectivity') {
    return `Failed to reach the ${service}.`
  }

  if (kind === 'rate_limit') {
    return `${options.operation} was rate limited by the provider.`
  }

  if (kind === 'authentication') {
    return 'The AI provider rejected the request. Check the API key and model access.'
  }

  const preferredMessage =
    messages.find((message) => !/^Failed after \d+ attempts\./.test(message))
    ?? messages[0]

  return preferredMessage || fallback
}

export async function retryOnRetryableAiError<T>(
  run: (attempt: number) => Promise<T>,
  options?: {
    maxAttempts?: number
    delayMs?: number
  },
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 1)
  const delayMs = Math.max(0, options?.delayMs ?? 0)
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await run(attempt)
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts || !isRetryableAiProviderError(error)) {
        throw error
      }

      if (delayMs > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, delayMs * attempt)
        })
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('AI request failed')
}

export function createTimeoutAbortSignal(
  timeoutMs: number,
  signal?: AbortSignal,
) {
  if (timeoutMs <= 0) {
    return signal
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  if (!signal) {
    return timeoutSignal
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeoutSignal])
  }

  const controller = new AbortController()

  const abortWith = (reason?: unknown) => {
    if (!controller.signal.aborted) {
      controller.abort(reason)
    }
  }

  signal.addEventListener('abort', () => abortWith(signal.reason), { once: true })
  timeoutSignal.addEventListener('abort', () => abortWith(timeoutSignal.reason), { once: true })

  return controller.signal
}
