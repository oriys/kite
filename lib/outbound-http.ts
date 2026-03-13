import 'server-only'

const LOOPBACK_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1'])

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
}

function isLoopbackHostname(hostname: string) {
  const normalized = normalizeHostname(hostname)
  return (
    LOOPBACK_HOSTNAMES.has(normalized) ||
    normalized === '127.0.0.1' ||
    normalized.startsWith('127.')
  )
}

export function parsePublicHttpUrl(input: string): URL {
  let targetUrl: URL

  try {
    targetUrl = new URL(input)
  } catch {
    throw new Error('Invalid URL')
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported')
  }

  if (isLoopbackHostname(targetUrl.hostname)) {
    throw new Error('Loopback URLs are not allowed')
  }

  return targetUrl
}

export function getOutboundRequestErrorMessage(
  error: unknown,
  timeoutMs?: number,
) {
  if (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    if (!timeoutMs) {
      return 'Request timed out'
    }

    const seconds = Math.max(1, Math.ceil(timeoutMs / 1000))
    return `Request timed out after ${seconds}s`
  }

  if (error instanceof TypeError) {
    return 'Failed to reach the remote URL'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

export async function fetchTextFromUrl(
  input: string | URL,
  options: {
    timeoutMs?: number
    headers?: HeadersInit
  } = {},
) {
  const timeoutMs = options.timeoutMs ?? 15_000
  const targetUrl =
    typeof input === 'string' ? parsePublicHttpUrl(input) : input

  const response = await fetch(targetUrl.toString(), {
    cache: 'no-store',
    headers: options.headers,
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((error: unknown) => {
    throw new Error(getOutboundRequestErrorMessage(error, timeoutMs), {
      cause: error instanceof Error ? error : undefined,
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  return response.text()
}
