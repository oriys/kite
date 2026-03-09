'use client'

import * as React from 'react'
import { marked } from 'marked'
import { cn } from '@/lib/utils'

marked.setOptions({
  gfm: true,
  breaks: true,
})

interface MarkdownPreviewProps extends React.ComponentProps<'div'> {
  content: string
}

export function MarkdownPreview({ content, className, ...props }: MarkdownPreviewProps) {
  const html = React.useMemo(() => {
    if (!content.trim()) return '<p class="text-muted-foreground italic">No content yet…</p>'
    return marked.parse(content, { async: false }) as string
  }, [content])

  return (
    <div
      className={cn('prose-editorial', className)}
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  )
}
