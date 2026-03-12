'use client'

import { HTTPSnippet, type HarRequest, type TargetId, type ClientId } from 'httpsnippet-lite'

export interface RequestConfig {
  method: string
  url: string
  headers: { key: string; value: string }[]
  body?: string
}

export interface CodeTarget {
  id: string
  label: string
  language: string
  clientId: string
  targetId: string
}

export const CODE_TARGETS: CodeTarget[] = [
  { id: 'curl', label: 'cURL', language: 'bash', targetId: 'shell', clientId: 'curl' },
  { id: 'python', label: 'Python', language: 'python', targetId: 'python', clientId: 'requests' },
  { id: 'javascript', label: 'JavaScript', language: 'javascript', targetId: 'javascript', clientId: 'fetch' },
  { id: 'node', label: 'Node.js', language: 'javascript', targetId: 'node', clientId: 'fetch' },
  { id: 'go', label: 'Go', language: 'go', targetId: 'go', clientId: 'native' },
]

export async function generateCodeSnippet(
  config: RequestConfig,
  target: CodeTarget,
): Promise<string> {
  try {
    const parsedUrl = new URL(config.url)

    const harHeaders = config.headers
      .filter((h) => h.key && h.value)
      .map((h) => ({ name: h.key, value: h.value }))

    const harEntry: HarRequest = {
      method: config.method.toUpperCase(),
      url: parsedUrl.toString(),
      httpVersion: 'HTTP/1.1',
      headers: harHeaders,
      queryString: Array.from(parsedUrl.searchParams.entries()).map(([name, value]) => ({
        name,
        value,
      })),
      cookies: [],
      headersSize: -1,
      bodySize: -1,
    }

    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase())) {
      const contentType =
        config.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ||
        'application/json'
      harEntry.postData = {
        mimeType: contentType,
        text: config.body,
      }
    }

    const snippet = new HTTPSnippet(harEntry)
    const result = await snippet.convert(target.targetId as TargetId, target.clientId as ClientId)
    return Array.isArray(result) ? result[0] : (result as string)
  } catch {
    const commentMap: Record<string, string> = {
      bash: '#',
      python: '#',
      javascript: '//',
      go: '//',
    }
    const prefix = commentMap[target.language] ?? '//'
    return `${prefix} Failed to generate code snippet.\n${prefix} Check that the URL and request config are valid.`
  }
}
