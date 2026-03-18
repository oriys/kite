'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { renderMarkdown } from '@/lib/markdown'
import { extractMarkdownHeadings } from '@/lib/markdown-outline'
import { sanitizeHtml } from '@/lib/sanitize'

interface PublicDocReaderProps {
  title: string
  content: string
  updatedAt: Date
}

export function PublicDocReader({ title, content, updatedAt }: PublicDocReaderProps) {
  const [activeId, setActiveId] = React.useState<string>('')
  const headings = React.useMemo(
    () => extractMarkdownHeadings(content),
    [content],
  )
  const html = React.useMemo(() => {
    if (!content.trim()) return '<p class="text-muted-foreground italic">No content.</p>'
    return sanitizeHtml(renderMarkdown(content))
  }, [content])

  React.useEffect(() => {
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
    )

    for (const h of headings) {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  return (
    <div className="flex gap-10">
      {/* Content */}
      <article className="min-w-0 flex-1">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated{' '}
            <time dateTime={updatedAt.toISOString()}>
              {updatedAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </p>
        </header>
        <div
          className="prose-editorial"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      {/* Table of Contents */}
      {headings.length > 2 && (
        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="sticky top-20">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              On this page
            </p>
            <nav className="flex flex-col gap-0.5">
              {headings.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className={cn(
                    'truncate rounded-sm py-1 text-[13px] leading-snug transition-colors',
                    h.level === 1 && 'pl-0',
                    h.level === 2 && 'pl-0',
                    h.level === 3 && 'pl-3',
                    h.level === 4 && 'pl-6',
                    activeId === h.id
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      )}
    </div>
  )
}
