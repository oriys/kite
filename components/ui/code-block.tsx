'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { highlightCodeSegments, normalizeCodeLanguage } from '@/lib/code-highlighting'
import { CopyButton } from '@/components/ui/copy-button'

type Language = 'json' | 'bash' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'graphql' | 'text'

interface CodeBlockProps extends React.ComponentProps<'pre'> {
  code: string
  language?: Language | string
  copy?: boolean
}

function highlightCode(code: string, language: string): React.ReactNode[] {
  return highlightCodeSegments(code, language).map((segment, index) =>
    segment.className ? (
      <span key={index} className={segment.className}>
        {segment.text}
      </span>
    ) : (
      segment.text
    ),
  )
}

function CodeBlock({ code, language = 'text', copy = true, className, ...props }: CodeBlockProps) {
  const normalizedLanguage = React.useMemo(
    () => normalizeCodeLanguage(language),
    [language],
  )
  const highlighted = React.useMemo(
    () => highlightCode(code, normalizedLanguage),
    [code, normalizedLanguage],
  )

  return (
    <div className={cn("relative group", className)}>
      <pre
        className={cn(
          'overflow-x-auto font-mono text-[13px] leading-6 text-foreground p-4',
          // removed className here to avoid conflict with wrapper className if any
        )}
        {...props}
      >
        <code className={normalizedLanguage !== 'text' ? `language-${normalizedLanguage}` : undefined}>
          {highlighted}
        </code>
      </pre>
      {copy && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton value={code} className="h-6 w-6 border bg-background/80 shadow-sm backdrop-blur-sm" />
        </div>
      )}
    </div>
  )
}

export { CodeBlock, highlightCode }
export type { Language }
