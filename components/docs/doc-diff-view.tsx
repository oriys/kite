'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { diffTexts, type DiffBlock } from '@/lib/diff'

interface DocDiffViewProps {
  leftContent: string
  rightContent: string
  className?: string
}

export function DocDiffView({ leftContent, rightContent, className }: DocDiffViewProps) {
  const diff = React.useMemo(
    () => diffTexts(leftContent, rightContent),
    [leftContent, rightContent],
  )

  return (
    <div className={cn('grid grid-cols-2 divide-x divide-border/60 font-mono text-[13px] leading-6', className)}>
      <DiffColumn blocks={diff.blocks} side="left" />
      <DiffColumn blocks={diff.blocks} side="right" />
    </div>
  )
}

export function DiffStats({ leftContent, rightContent, className }: DocDiffViewProps) {
  const diff = React.useMemo(
    () => diffTexts(leftContent, rightContent),
    [leftContent, rightContent],
  )

  if (diff.stats.additions === 0 && diff.stats.removals === 0) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        No differences
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-2 text-xs', className)}>
      {diff.stats.additions > 0 && (
        <span className="text-[var(--diff-add-text)]">+{diff.stats.additions}</span>
      )}
      {diff.stats.removals > 0 && (
        <span className="text-[var(--diff-remove-text)]">−{diff.stats.removals}</span>
      )}
      <span className="text-muted-foreground">{diff.stats.unchanged} unchanged</span>
    </span>
  )
}

function DiffColumn({ blocks, side }: { blocks: DiffBlock[]; side: 'left' | 'right' }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      {blocks.map((block, bi) => {
        const lines = side === 'left' ? block.leftLines : block.rightLines

        if (block.type === 'equal') {
          return (
            <div key={bi}>
              {lines.map((line, li) => (
                <div key={li} className="flex">
                  <LineGutter number={line.lineNumber} />
                  <div className="flex-1 whitespace-pre-wrap break-all px-3 py-px">
                    {line.text || '\u00A0'}
                  </div>
                </div>
              ))}
            </div>
          )
        }

        // Change block
        const otherLines = side === 'left' ? block.rightLines : block.leftLines
        const maxLen = Math.max(lines.length, otherLines.length)
        const padded = padLines(lines, maxLen)

        return (
          <div key={bi}>
            {padded.map((line, li) => {
              if (!line) {
                // Padding line — empty filler for alignment
                return (
                  <div
                    key={li}
                    className="flex bg-[var(--diff-gutter)]/30"
                  >
                    <LineGutter />
                    <div className="flex-1 px-3 py-px">{'\u00A0'}</div>
                  </div>
                )
              }

              const isRemove = line.type === 'remove'
              const isAdd = line.type === 'add'

              return (
                <div
                  key={li}
                  className={cn(
                    'flex',
                    isRemove && 'bg-[var(--diff-remove-bg)] text-[var(--diff-remove-text)]',
                    isAdd && 'bg-[var(--diff-add-bg)] text-[var(--diff-add-text)]',
                  )}
                >
                  <LineGutter number={line.lineNumber} />
                  <div className="flex-1 px-3 py-px">
                    <span className="mr-1.5 inline-block w-3 select-none text-center opacity-60">
                      {isRemove ? '−' : isAdd ? '+' : ' '}
                    </span>
                    <span className="whitespace-pre-wrap break-all">{line.text || '\u00A0'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function LineGutter({ number }: { number?: number }) {
  return (
    <div className="w-12 shrink-0 select-none bg-[var(--diff-gutter)] px-2 py-px text-right text-[11px] text-[var(--diff-gutter-text)]">
      {number ?? ''}
    </div>
  )
}

function padLines<T>(lines: T[], targetLength: number): (T | null)[] {
  const result: (T | null)[] = [...lines]
  while (result.length < targetLength) {
    result.push(null)
  }
  return result
}
