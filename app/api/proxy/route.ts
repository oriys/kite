import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  getOutboundRequestErrorMessage,
  parsePublicHttpUrl,
} from '@/lib/outbound-http'
import { saveRequestHistory } from '@/lib/queries/api-environments'

/**
 * CORS proxy — relays API requests from the playground to avoid browser CORS issues.
 */
export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { method, url, headers, requestBody, environmentId } = body

  if (!url || typeof url !== 'string') return badRequest('URL is required')
  if (!method || typeof method !== 'string') return badRequest('Method is required')

  let targetUrl: URL
  try {
    targetUrl = parsePublicHttpUrl(url)
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid URL')
  }

  const reqHeaders: Record<string, string> = {}
  if (typeof headers === 'object' && headers !== null) {
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === 'string') reqHeaders[k] = v
    }
  }

  const startTime = Date.now()
  let responseStatus: number | undefined
  const responseHeaders: Record<string, string> = {}
  let responseBody: string | undefined

  try {
    const fetchOptions: RequestInit = {
      cache: 'no-store',
      method: method.toUpperCase(),
      headers: reqHeaders,
      signal: AbortSignal.timeout(30000),
    }

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && requestBody) {
      fetchOptions.body =
        typeof requestBody === 'string'
          ? requestBody
          : JSON.stringify(requestBody)
    }

    const response = await fetch(targetUrl.toString(), fetchOptions)
    responseStatus = response.status
    responseBody = await response.text()
    response.headers.forEach((v, k) => {
      responseHeaders[k] = v
    })
  } catch (err) {
    const durationMs = Date.now() - startTime
    await saveRequestHistory(result.ctx.workspaceId, result.ctx.userId, {
      method,
      url,
      headers: reqHeaders,
      body: typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody),
      durationMs,
      environmentId,
    })

    return NextResponse.json(
      {
        error: getOutboundRequestErrorMessage(err, 30_000),
        durationMs,
      },
      { status: 502 },
    )
  }

  const durationMs = Date.now() - startTime

  // Save to history
  await saveRequestHistory(result.ctx.workspaceId, result.ctx.userId, {
    method,
    url,
    headers: reqHeaders,
    body: typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody),
    responseStatus,
    responseHeaders,
    responseBody: responseBody?.slice(0, 100_000),
    durationMs,
    environmentId,
  })

  return NextResponse.json({
    status: responseStatus,
    headers: responseHeaders,
    body: responseBody,
    durationMs,
  })
}
