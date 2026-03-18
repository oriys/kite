import { NextRequest, NextResponse } from 'next/server'

interface TryItRequest {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '169.254.169.254', // cloud metadata
  'metadata.google.internal',
]

function isBlockedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname.toLowerCase()
    if (BLOCKED_HOSTS.includes(hostname)) return true
    // Block private IP ranges
    if (/^10\./.test(hostname)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true
    if (/^192\.168\./.test(hostname)) return true
    return false
  } catch {
    return true
  }
}

export async function POST(request: NextRequest) {
  let payload: TryItRequest
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { method, url, headers, body } = payload

  if (!method || !url) {
    return NextResponse.json(
      { error: 'method and url are required' },
      { status: 400 },
    )
  }

  if (isBlockedUrl(url)) {
    return NextResponse.json(
      { error: 'Requests to localhost and private networks are not allowed' },
      { status: 403 },
    )
  }

  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  const upperMethod = method.toUpperCase()
  if (!allowedMethods.includes(upperMethod)) {
    return NextResponse.json(
      { error: `Unsupported method: ${method}` },
      { status: 400 },
    )
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    const start = performance.now()
    const response = await fetch(url, {
      method: upperMethod,
      headers: headers ?? {},
      body: ['GET', 'HEAD'].includes(upperMethod) ? undefined : (body ?? undefined),
      signal: controller.signal,
      redirect: 'follow',
    })
    const duration = Math.round(performance.now() - start)
    clearTimeout(timeout)

    const responseBody = await response.text()
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed'
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json(
      { error: isTimeout ? 'Request timed out after 30 seconds' : message },
      { status: isTimeout ? 504 : 502 },
    )
  }
}
