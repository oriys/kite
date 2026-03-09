'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/ui/copy-button'

type Language = 'json' | 'bash' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'graphql' | 'text'

interface CodeBlockProps extends React.ComponentProps<'pre'> {
  code: string
  language?: Language | string
  copy?: boolean
}

const tokenPatterns: Record<string, Array<{ pattern: RegExp; className: string }>> = {
  json: [
    { pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/g, className: 'text-foreground font-medium' },
    { pattern: /"(?:\\.|[^"\\])*"/g, className: 'text-tone-success-text' },
    { pattern: /\b(true|false|null)\b/g, className: 'text-tone-info-text font-medium' },
    { pattern: /\b-?\d+\.?\d*(?:[eE][+-]?\d+)?\b/g, className: 'text-tone-caution-text' },
  ],
  bash: [
    { pattern: /#.*/g, className: 'text-muted-foreground italic' },
    { pattern: /"(?:\\.|[^"\\])*"/g, className: 'text-tone-success-text' },
    { pattern: /'(?:\\.|[^'\\])*'/g, className: 'text-tone-success-text' },
    { pattern: /\$[A-Z_][A-Z0-9_]*/g, className: 'text-tone-info-text' },
    { pattern: /\b(curl|wget|echo|export|if|then|else|fi|for|do|done|while)\b/g, className: 'text-tone-info-text font-medium' },
    { pattern: /\s(-[A-Za-z]|--[A-Za-z-]+)/g, className: 'text-tone-caution-text' },
    { pattern: /https?:\/\/[^\s"'\\]+/g, className: 'text-foreground underline decoration-border' },
  ],
  javascript: [
    { pattern: /\/\/.*/g, className: 'text-muted-foreground italic' },
    { pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, className: 'text-tone-success-text' },
    { pattern: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|new|this|typeof|instanceof|throw|try|catch|finally)\b/g, className: 'text-tone-info-text font-medium' },
    { pattern: /\b-?\d+\.?\d*\b/g, className: 'text-tone-caution-text' },
    { pattern: /\b(true|false|null|undefined)\b/g, className: 'text-tone-info-text' },
  ],
  graphql: [
    { pattern: /#.*/g, className: 'text-muted-foreground italic' },
    { pattern: /"(?:\\.|[^"\\])*"/g, className: 'text-tone-success-text' },
    { pattern: /\b(query|mutation|subscription|fragment|type|input|enum|interface|union|scalar|schema|extend|on|implements)\b/g, className: 'text-tone-info-text font-medium' },
    { pattern: /\b(String|Int|Float|Boolean|ID|DateTime)\b!?/g, className: 'text-tone-caution-text' },
    { pattern: /\$\w+/g, className: 'text-tone-mutation-text' },
  ],
}

tokenPatterns.typescript = tokenPatterns.javascript
tokenPatterns.jsx = tokenPatterns.javascript
tokenPatterns.tsx = tokenPatterns.javascript

function highlightCode(code: string, language: string): React.ReactNode[] {
  const patterns = tokenPatterns[language]
  if (!patterns) {
    return [code]
  }

  type Span = { start: number; end: number; className: string; text: string }
  const spans: Span[] = []

  for (const { pattern, className } of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(code)) !== null) {
      const start = match.index
      const end = start + match[0].length
      // Only add if no overlap with existing spans
      const overlaps = spans.some(
        (s) => (start >= s.start && start < s.end) || (end > s.start && end <= s.end),
      )
      if (!overlaps) {
        spans.push({ start, end, className, text: match[0] })
      }
    }
  }

  spans.sort((a, b) => a.start - b.start)

  const result: React.ReactNode[] = []
  let cursor = 0

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (cursor < span.start) {
      result.push(code.slice(cursor, span.start))
    }
    result.push(
      <span key={i} className={span.className}>
        {span.text}
      </span>,
    )
    cursor = span.end
  }

  if (cursor < code.length) {
    result.push(code.slice(cursor))
  }

  return result
}

function CodeBlock({ code, language = 'text', copy = true, className, ...props }: CodeBlockProps) {
  const highlighted = React.useMemo(
    () => highlightCode(code, language),
    [code, language],
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
        <code>{highlighted}</code>
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
