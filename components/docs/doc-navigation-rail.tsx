'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface DocNavigationHeading {
  id: string
  index: number
  level: number
  title: string
  line: number
  progress: number
}

interface DocNavigationBlock {
  id: string
  index: number
  kind: 'heading' | 'paragraph' | 'list' | 'code' | 'quote' | 'table' | 'rule'
  label: string
  depth: number
  start: number
  end: number
}

interface DocNavigationRailProps {
  content: string
  tocOpen: boolean
  minimapOpen: boolean
  scrollProgress: number
  viewportRatio: number
  onJumpToHeading: (heading: DocNavigationHeading) => void
  onJumpToProgress: (progress: number) => void
}

function stripMarkdownInline(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function blockKindLabel(kind: DocNavigationBlock['kind']) {
  switch (kind) {
    case 'heading':
      return 'Heading'
    case 'list':
      return 'List'
    case 'code':
      return 'Code block'
    case 'quote':
      return 'Quote'
    case 'table':
      return 'Table'
    case 'rule':
      return 'Divider'
    default:
      return 'Paragraph'
  }
}

function isListLine(line: string) {
  return /^([-*+]|\d+\.)\s+/.test(line)
}

function detectBlockKind(line: string): DocNavigationBlock['kind'] {
  if (/^#{1,6}\s+/.test(line)) return 'heading'
  if (isListLine(line)) return 'list'
  if (line.startsWith('>')) return 'quote'
  if (line.startsWith('|')) return 'table'
  if (/^([-*_]){3,}\s*$/.test(line.replace(/\s+/g, ''))) return 'rule'
  return 'paragraph'
}

function getBlockTone(kind: DocNavigationBlock['kind']) {
  switch (kind) {
    case 'heading':
      return 'bg-foreground/55'
    case 'code':
      return 'bg-sky-500/45'
    case 'list':
      return 'bg-emerald-500/40'
    case 'quote':
      return 'bg-amber-500/40'
    case 'table':
      return 'bg-violet-500/40'
    case 'rule':
      return 'bg-border'
    default:
      return 'bg-muted-foreground/30'
  }
}

function parseMarkdownNavigation(content: string) {
  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const totalLines = Math.max(lines.length, 1)
  const headingDivisor = Math.max(totalLines - 1, 1)
  const headings: DocNavigationHeading[] = []
  const blocks: DocNavigationBlock[] = []

  const pushBlock = (
    kind: DocNavigationBlock['kind'],
    label: string,
    depth: number,
    startLine: number,
    endLine: number,
  ) => {
    const safeStart = Math.max(0, Math.min(startLine, totalLines - 1))
    const safeEnd = Math.max(safeStart + 1, Math.min(endLine, totalLines))

    blocks.push({
      id: `block-${blocks.length}`,
      index: blocks.length,
      kind,
      label: label || blockKindLabel(kind),
      depth,
      start: safeStart / totalLines,
      end: safeEnd / totalLines,
    })
  }

  let lineIndex = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const trimmed = line.trim()

    if (!trimmed) {
      lineIndex += 1
      continue
    }

    const fenceMatch = trimmed.match(/^(```+|~~~+)\s*([^`~\s]+)?/)
    if (fenceMatch) {
      const fenceToken = fenceMatch[1]
      const fenceChar = fenceToken[0]
      const closeFencePattern = new RegExp(`^${fenceChar}{${fenceToken.length},}\\s*$`)
      const startLine = lineIndex
      let endLine = lineIndex + 1

      while (endLine < lines.length) {
        if (closeFencePattern.test(lines[endLine].trim())) {
          endLine += 1
          break
        }
        endLine += 1
      }

      pushBlock(
        'code',
        fenceMatch[2] ? `${fenceMatch[2]} code` : 'Code block',
        0,
        startLine,
        endLine,
      )
      lineIndex = endLine
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = stripMarkdownInline(headingMatch[2]) || `Heading ${headings.length + 1}`

      headings.push({
        id: `heading-${headings.length}`,
        index: headings.length,
        level,
        title,
        line: lineIndex,
        progress: lineIndex / headingDivisor,
      })

      pushBlock('heading', title, level, lineIndex, lineIndex + 1)
      lineIndex += 1
      continue
    }

    const kind = detectBlockKind(trimmed)
    const startLine = lineIndex
    let endLine = lineIndex + 1

    while (endLine < lines.length) {
      const nextLine = lines[endLine]
      const nextTrimmed = nextLine.trim()

      if (!nextTrimmed) break
      if (/^(```+|~~~+)/.test(nextTrimmed)) break
      if (/^#{1,6}\s+/.test(nextTrimmed)) break
      if (kind === 'list' && !isListLine(nextTrimmed)) break
      if (kind === 'quote' && !nextTrimmed.startsWith('>')) break
      if (kind === 'table' && !nextTrimmed.startsWith('|')) break
      if (kind === 'rule') break

      endLine += 1
    }

    const label =
      stripMarkdownInline(
        lines
          .slice(startLine, endLine)
          .find((entry) => entry.trim().length > 0)
          ?.trim() ?? '',
      ) || blockKindLabel(kind)

    pushBlock(kind, label, 0, startLine, endLine)
    lineIndex = endLine
  }

  return {
    headings,
    blocks,
  }
}

function resolveActiveHeadingId(
  headings: DocNavigationHeading[],
  scrollProgress: number,
) {
  if (!headings.length) return null

  const threshold = Math.min(1, Math.max(0, scrollProgress) + 0.04)
  let activeId = headings[0].id

  for (const heading of headings) {
    if (heading.progress <= threshold) {
      activeId = heading.id
      continue
    }

    break
  }

  return activeId
}

export function DocNavigationRail({
  content,
  tocOpen,
  minimapOpen,
  scrollProgress,
  viewportRatio,
  onJumpToHeading,
  onJumpToProgress,
}: DocNavigationRailProps) {
  const deferredContent = React.useDeferredValue(content)
  const navigation = React.useMemo(
    () => parseMarkdownNavigation(deferredContent),
    [deferredContent],
  )
  const activeHeadingId = React.useMemo(
    () => resolveActiveHeadingId(navigation.headings, scrollProgress),
    [navigation.headings, scrollProgress],
  )
  const activeHeading =
    navigation.headings.find((heading) => heading.id === activeHeadingId) ?? null
  const clampedViewportRatio = Math.min(1, Math.max(viewportRatio, 0.08))
  const viewportTop = Math.min(
    Math.max(scrollProgress, 0),
    Math.max(0, 1 - clampedViewportRatio),
  )

  if (!tocOpen && !minimapOpen) {
    return null
  }

  return (
    <aside className="flex h-72 shrink-0 flex-col border-t border-border/60 bg-muted/20 md:h-auto md:w-64 md:border-t-0 md:border-l">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
        {tocOpen ? (
          <section className={cn('min-h-0 rounded-xl border border-border/60 bg-background/80', minimapOpen ? 'flex-1' : 'flex-1')}>
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Table of Contents
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {navigation.headings.length > 0
                    ? `${navigation.headings.length} sections`
                    : 'No headings yet'}
                </p>
              </div>
            </div>
            <div className="max-h-full overflow-auto px-2 py-2">
              {navigation.headings.length > 0 ? (
                <nav className="space-y-1">
                  {navigation.headings.map((heading) => (
                    <button
                      key={heading.id}
                      type="button"
                      onClick={() => onJumpToHeading(heading)}
                      className={cn(
                        'flex w-full items-start rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                        activeHeadingId === heading.id
                          ? 'bg-accent/15 text-foreground'
                          : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground',
                      )}
                      style={{ paddingLeft: `${Math.min(heading.level, 4) * 10}px` }}
                    >
                      <span className="line-clamp-2 leading-5">{heading.title}</span>
                    </button>
                  ))}
                </nav>
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  Add markdown headings like <code>#</code> or <code>##</code> to build a table of contents.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {minimapOpen ? (
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/60 bg-background/80">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Minimap
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeHeading ? activeHeading.title : 'Document overview'}
                </p>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              <div
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  if (rect.height <= 0) return
                  const nextProgress = (event.clientY - rect.top) / rect.height
                  onJumpToProgress(nextProgress)
                }}
                className="relative min-h-[180px] flex-1 overflow-hidden rounded-lg border border-border/50 bg-muted/30 text-left"
              >
                <div className="absolute inset-2">
                  {navigation.blocks.map((block) => {
                    const top = `${block.start * 100}%`
                    const height = `${Math.max((block.end - block.start) * 100, 1.5)}%`
                    const left = `${Math.min(block.depth, 4) * 8}px`

                    return (
                      <button
                        key={block.id}
                        type="button"
                        title={block.label}
                        onClick={(event) => {
                          event.stopPropagation()
                          onJumpToProgress(block.start)
                        }}
                        className={cn(
                          'absolute right-0 rounded-full transition-opacity hover:opacity-100',
                          getBlockTone(block.kind),
                        )}
                        style={{
                          top,
                          height,
                          left,
                          opacity: activeHeading && block.label === activeHeading.title ? 1 : 0.8,
                        }}
                      />
                    )
                  })}

                  <div
                    className="pointer-events-none absolute inset-x-0 rounded-md border border-foreground/20 bg-background/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-[2px]"
                    style={{
                      top: `${viewportTop * 100}%`,
                      height: `${clampedViewportRatio * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Viewport</span>
                  <span>{Math.round(Math.max(0, scrollProgress) * 100)}%</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Blocks</span>
                  <span>{navigation.blocks.length}</span>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  )
}
