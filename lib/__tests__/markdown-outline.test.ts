import { describe, expect, it } from 'vitest'

import { extractMarkdownHeadings } from '@/lib/markdown-outline'

describe('extractMarkdownHeadings', () => {
  it('extracts normalized heading text and ids from markdown', () => {
    expect(
      extractMarkdownHeadings(`# Getting Started

## **Authenticate**

### Use the [SDK](https://example.com)
`),
    ).toEqual([
      { id: 'getting-started', text: 'Getting Started', level: 1 },
      { id: 'authenticate', text: 'Authenticate', level: 2 },
      { id: 'use-the-sdk', text: 'Use the SDK', level: 3 },
    ])
  })

  it('ignores headings deeper than level 4 by default', () => {
    expect(
      extractMarkdownHeadings(`#### Included

##### Hidden
`),
    ).toEqual([{ id: 'included', text: 'Included', level: 4 }])
  })
})
