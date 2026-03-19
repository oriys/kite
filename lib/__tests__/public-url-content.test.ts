import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PublicUrlContentError,
  fetchPublicUrlContent,
} from '@/lib/public-url-content'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPublicUrlContent', () => {
  it('extracts readable text and title from HTML pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          '<html><head><title>Auth &amp; Orders</title></head><body><main><h1>Authentication</h1><p>Use an API key.</p></main></body></html>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        ),
      ),
    )

    const result = await fetchPublicUrlContent('https://example.com/docs/authentication')

    expect(result.title).toBe('Auth & Orders')
    expect(result.rawContent).toContain('Authentication')
    expect(result.rawContent).toContain('Use an API key.')
  })

  it('returns plain text content unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('plain text body', {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
      ),
    )

    const result = await fetchPublicUrlContent('https://example.com/docs/orders')

    expect(result.title).toBe('orders')
    expect(result.rawContent).toBe('plain text body')
  })

  it('rejects unsupported content types', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('binary', {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        }),
      ),
    )

    await expect(
      fetchPublicUrlContent('https://example.com/download.bin'),
    ).rejects.toMatchObject<Partial<PublicUrlContentError>>({
      code: 'unsupported_content_type',
    })
  })
})
