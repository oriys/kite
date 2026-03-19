import { fetchResponseFromUrl } from '@/lib/outbound-http'

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

const DEFAULT_ACCEPT_HEADER = [
  'text/html',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/yaml',
  'text/yaml',
  'text/x-markdown',
  'application/xml',
  'text/xml',
].join(', ')

export type PublicUrlContentErrorCode =
  | 'invalid_url'
  | 'fetch_failed'
  | 'unsupported_content_type'
  | 'content_too_large'

export class PublicUrlContentError extends Error {
  readonly code: PublicUrlContentErrorCode

  constructor(message: string, code: PublicUrlContentErrorCode) {
    super(message)
    this.name = 'PublicUrlContentError'
    this.code = code
  }
}

export interface PublicUrlContent {
  title: string
  rawContent: string
  sourceUrl: string
  contentType: string
}

interface FetchPublicUrlContentOptions {
  timeoutMs?: number
  maxChars?: number
  acceptHeader?: string
}

export function deriveTitleFromUrl(value: string) {
  try {
    const url = new URL(value)
    const lastSegment =
      url.pathname
        .split('/')
        .filter(Boolean)
        .at(-1)
        ?.replace(/[-_]+/g, ' ')
        .trim() ?? ''

    return lastSegment || url.hostname
  } catch {
    return value
  }
}

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (entity, token: string) => {
      const normalized = token.toLowerCase()
      if (normalized.startsWith('#x')) {
        const codePoint = Number.parseInt(normalized.slice(2), 16)
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity
      }
      if (normalized.startsWith('#')) {
        const codePoint = Number.parseInt(normalized.slice(1), 10)
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity
      }
      return HTML_ENTITY_MAP[normalized] ?? entity
    },
  )
}

function stripHtmlToText(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : ''

  const text = decodeHtmlEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|main|header|footer|aside|li|ul|ol|table|thead|tbody|tfoot|tr|td|th|h[1-6])>/gi, '\n')
      .replace(/<(li|tr)\b[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )

  return {
    title,
    text,
  }
}

function getPublicUrlErrorCode(error: unknown): PublicUrlContentErrorCode {
  const message =
    error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  if (
    normalized.includes('invalid url')
    || normalized.includes('only http and https')
    || normalized.includes('loopback urls are not allowed')
    || normalized.includes('private/internal urls are not allowed')
  ) {
    return 'invalid_url'
  }

  return 'fetch_failed'
}

export async function fetchPublicUrlContent(
  sourceUrl: string,
  options: FetchPublicUrlContentOptions = {},
): Promise<PublicUrlContent> {
  const timeoutMs = options.timeoutMs ?? 15_000
  const maxChars = options.maxChars ?? 200_000

  let response: Response
  try {
    response = await fetchResponseFromUrl(sourceUrl, {
      timeoutMs,
      headers: {
        Accept: options.acceptHeader ?? DEFAULT_ACCEPT_HEADER,
      },
    })
  } catch (error) {
    throw new PublicUrlContentError(
      error instanceof Error ? error.message : 'Failed to fetch URL',
      getPublicUrlErrorCode(error),
    )
  }

  const rawContent = await response.text()
  if (rawContent.length > maxChars) {
    throw new PublicUrlContentError(
      `URL content is too large. Keep it under ${maxChars.toLocaleString()} characters.`,
      'content_too_large',
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    const { title, text } = stripHtmlToText(rawContent)
    return {
      title: title || deriveTitleFromUrl(sourceUrl),
      rawContent: text,
      sourceUrl,
      contentType,
    }
  }

  if (
    contentType
    && !/text\/|application\/json|application\/yaml|text\/yaml|text\/x-markdown|application\/xml|text\/xml/i.test(
      contentType,
    )
  ) {
    throw new PublicUrlContentError(
      `Unsupported URL content type: ${contentType}`,
      'unsupported_content_type',
    )
  }

  return {
    title: deriveTitleFromUrl(sourceUrl),
    rawContent,
    sourceUrl,
    contentType,
  }
}
