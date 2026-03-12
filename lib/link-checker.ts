export interface LinkCheckResult {
  url: string
  statusCode: number | null
  isAlive: boolean
  errorMessage: string | null
}

const MARKDOWN_LINK_RE = /\[(?:[^\]]*)\]\((https?:\/\/[^)]+)\)/g
const HTML_LINK_RE = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi
const RAW_URL_RE = /(?<!\(|["'])https?:\/\/[^\s<>)"']+/g

export function extractLinksFromContent(content: string): string[] {
  const urls = new Set<string>()

  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    urls.add(match[1])
  }
  for (const match of content.matchAll(HTML_LINK_RE)) {
    urls.add(match[1])
  }
  for (const match of content.matchAll(RAW_URL_RE)) {
    urls.add(match[0])
  }

  return Array.from(urls)
}

export async function checkLink(url: string): Promise<LinkCheckResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'LinkChecker/1.0' },
    })

    const statusCode = response.status
    const isAlive = statusCode >= 200 && statusCode < 400

    return {
      url,
      statusCode,
      isAlive,
      errorMessage: isAlive ? null : `HTTP ${statusCode}`,
    }
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'Request timed out'
        : err instanceof Error
          ? err.message
          : 'Unknown error'

    return { url, statusCode: null, isAlive: false, errorMessage: message }
  } finally {
    clearTimeout(timeout)
  }
}

async function promisePool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
  return results
}

export async function checkDocumentLinks(
  documentId: string,
  workspaceId: string,
  content: string,
): Promise<LinkCheckResult[]> {
  const { upsertLinkCheck } = await import('@/lib/queries/link-checks')
  const urls = extractLinksFromContent(content)

  if (urls.length === 0) return []

  const tasks = urls.map((url) => () => checkLink(url))
  const results = await promisePool(tasks, 5)

  for (const result of results) {
    await upsertLinkCheck({
      workspaceId,
      documentId,
      url: result.url,
      statusCode: result.statusCode,
      isAlive: result.isAlive,
      errorMessage: result.errorMessage,
    })
  }

  return results
}
