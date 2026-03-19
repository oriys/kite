import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { parsePublicHttpUrl } from '@/lib/outbound-http'

interface TryItRequest {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

export async function POST(request: NextRequest) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error

  let payload: TryItRequest
  try {
    payload = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const { method, url, headers, body } = payload

  if (!method || !url) {
    return badRequest('method and url are required')
  }

  let targetUrl: URL
  try {
    targetUrl = parsePublicHttpUrl(url)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid URL' },
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
    const response = await fetch(targetUrl.toString(), {
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
