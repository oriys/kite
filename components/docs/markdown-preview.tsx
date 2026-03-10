'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { renderMarkdown } from '@/lib/markdown'

interface MarkdownPreviewProps extends React.ComponentProps<'div'> {
  content: string
}

export function MarkdownPreview({ content, className, ...props }: MarkdownPreviewProps) {
  const html = React.useMemo(() => {
    if (!content.trim()) return '<p class="text-muted-foreground italic">No content yet…</p>'
    return renderMarkdown(content)
  }, [content])

  return (
    <div
      className={cn('prose-editorial', className)}
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  )
}
