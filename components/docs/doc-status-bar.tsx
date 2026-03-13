'use client'
import * as React from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
  WifiOff,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'

import { cn, wordCount } from '@/lib/utils'
import { type Doc, type DocStatus, STATUS_CONFIG } from '@/lib/documents'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline'

interface DocStatusBarProps {
  doc: Doc
  backBusy?: boolean
  saveState?: SaveState
  onBack?: () => void
  onTransition: (status: DocStatus) => void
  onDelete: () => void
  onDuplicate: () => void
  onRestoreVersion?: (content: string) => void
  className?: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function summarizeVersion(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) return 'Empty snapshot'
  if (normalized.length <= 88) return normalized
  return `${normalized.slice(0, 87).trimEnd()}…`
}

// Simple line-based diff for version comparison
interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: DiffLine[] = []

  // Simple LCS-based diff for reasonable performance
  const lcs = new Array(oldLines.length + 1)
  for (let i = 0; i <= oldLines.length; i++) {
    lcs[i] = new Array(newLines.length + 1).fill(0)
  }
  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }

  // Backtrack to produce diff
  let i = oldLines.length
  let j = newLines.length
  const stack: DiffLine[] = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: 'unchanged', text: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      stack.push({ type: 'added', text: newLines[j - 1] })
      j--
    } else {
      stack.push({ type: 'removed', text: oldLines[i - 1] })
      i--
    }
  }

  // Reverse the stack and limit context lines for readability
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k])
  }
  return result
}

function AnimatedMetricNumber({ value }: { value: number }) {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <span>{value.toLocaleString()}</span>
  }

  return (
    <span className="relative inline-flex h-[1.1rem] min-w-[2.5ch] items-center overflow-hidden font-medium tabular-nums">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {value.toLocaleString()}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// ── Version diff view ──────────────────────────────────────────────────────

import { type DocVersion } from '@/lib/documents'

function VersionDiffView({
  currentContent,
  version,
  onBack,
  onRestore,
}: {
  currentContent: string
  version: DocVersion
  onBack: () => void
  onRestore?: (content: string) => void
}) {
  const diff = React.useMemo(
    () => computeLineDiff(version.content, currentContent),
    [version.content, currentContent],
  )
  const changes = diff.filter((l) => l.type !== 'unchanged')
  const added = changes.filter((l) => l.type === 'added').length
  const removed = changes.filter((l) => l.type === 'removed').length

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
        <button type="button" onClick={onBack} className="rounded p-0.5 transition-colors hover:bg-muted/60">
          <ArrowLeft className="size-3.5" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {timeAgo(version.savedAt)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {version.wordCount.toLocaleString()} words
            {changes.length > 0 && (
              <>
                {' · '}
                {added > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>}
                {added > 0 && removed > 0 && ' '}
                {removed > 0 && <span className="text-rose-600 dark:text-rose-400">-{removed}</span>}
                {' lines changed'}
              </>
            )}
            {changes.length === 0 && ' · No changes'}
          </p>
        </div>
        {onRestore && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => onRestore(version.content)}
          >
            <RotateCcw className="size-3" />
            Restore
          </Button>
        )}
      </div>
      <div className="max-h-80 overflow-auto font-mono text-[11px] leading-5">
        {diff.map((line, i) => (
          <div
            key={i}
            className={cn(
              'whitespace-pre-wrap px-3 py-px',
              line.type === 'added' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              line.type === 'removed' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
              line.type === 'unchanged' && 'text-muted-foreground/70',
            )}
          >
            <span className="mr-2 inline-block w-3 select-none text-right opacity-50">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DocStatusBar({
  doc,
  backBusy = false,
  saveState = 'idle',
  onBack,
  onTransition,
  onDelete,
  onDuplicate,
  onRestoreVersion,
  className,
}: DocStatusBarProps) {
  const router = useRouter()
  const config = STATUS_CONFIG[doc.status]
  const wc = wordCount(doc.content)
  const recentVersions = doc.versions.slice(0, 6)
  const totalVersions = doc.versionCount ?? doc.versions.length
  const [diffVersionId, setDiffVersionId] = React.useState<string | null>(null)
  const hasSecondaryActions = doc.canDuplicate || doc.canDelete

  return (
    <div className={cn(
      'flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-2',
      className,
    )}>
      {/* Left — meta */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onBack ?? (() => router.push('/docs'))}
          disabled={backBusy}
        >
          {backBusy ? (
            <Loader2 className="mr-1.5 size-3 animate-spin" />
          ) : (
            <ArrowLeft className="mr-1.5 size-3" />
          )}
          {backBusy ? 'Summarizing…' : 'Back'}
        </Button>

        <StatusBadge label={config.label} tone={config.tone as StatusTone} />

        <span className="flex items-center gap-1">
          <FileText className="size-3" />
          <AnimatedMetricNumber value={wc} /> {wc === 1 ? 'word' : 'words'}
        </span>

        <span className="flex items-center gap-1">
          {saveState === 'saving' ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span className="text-muted-foreground">Saving…</span>
            </>
          ) : saveState === 'saved' ? (
            <>
              <Check className="size-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
            </>
          ) : saveState === 'error' ? (
            <>
              <AlertCircle className="size-3 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">Save failed · retrying</span>
            </>
          ) : saveState === 'offline' ? (
            <>
              <WifiOff className="size-3 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">Offline · will retry</span>
            </>
          ) : (
            <>
              <Clock className="size-3" />
              Saved {timeAgo(doc.updatedAt)}
            </>
          )}
        </span>

        {totalVersions > 0 ? (
          <Popover onOpenChange={(open) => { if (!open) setDiffVersionId(null) }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground/80 transition-colors hover:bg-muted/45 hover:text-foreground"
              >
                <span>{totalVersions}</span>
                <span>{totalVersions === 1 ? 'revision' : 'revisions'}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={cn('p-0', diffVersionId ? 'w-[540px]' : 'w-80')}>
              {diffVersionId ? (
                <VersionDiffView
                  currentContent={doc.content}
                  version={doc.versions.find((v) => v.id === diffVersionId)!}
                  onBack={() => setDiffVersionId(null)}
                  onRestore={onRestoreVersion ? (content) => {
                    onRestoreVersion(content)
                    setDiffVersionId(null)
                  } : undefined}
                />
              ) : (
                <>
                  <div className="border-b border-border/70 px-3 py-2">
                    <p className="text-sm font-medium text-foreground">Recent revisions</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Click a revision to see changes and optionally restore.
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {recentVersions.map((version, index) => (
                      <button
                        key={version.id}
                        type="button"
                        onClick={() => setDiffVersionId(version.id)}
                        className={cn(
                          'w-full space-y-1.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                          index > 0 && 'border-t border-border/60',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            {timeAgo(version.savedAt)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {version.wordCount.toLocaleString()} words
                            </span>
                            <ChevronRight className="size-3 text-muted-foreground/50" />
                          </div>
                        </div>
                        <p className="text-sm leading-6 text-foreground/90">
                          {summarizeVersion(version.content)}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        {/* Revert to draft (from review/published/archived) */}
        {doc.canTransition && doc.status !== 'draft' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs"
              >
                <RotateCcw className="mr-1.5 size-3" />
                Revert to Draft
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revert to Draft</AlertDialogTitle>
                <AlertDialogDescription>
                  This will move &ldquo;{doc.title}&rdquo; back to Draft. You
                  can promote it again later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onTransition('draft')}>
                  Revert to Draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* More actions */}
        {hasSecondaryActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {doc.canDuplicate ? (
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 size-3.5" />
                  Duplicate
                </DropdownMenuItem>
              ) : null}
              {doc.canDuplicate && doc.canDelete ? <DropdownMenuSeparator /> : null}
              {doc.canDelete ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {/* Primary lifecycle action */}
        {doc.canTransition && config.next && config.nextLabel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="h-7 px-3 text-xs">
                {config.nextLabel}
                <ChevronRight className="ml-1 size-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{config.nextLabel}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will move &ldquo;{doc.title}&rdquo; from {config.label} to{' '}
                  {STATUS_CONFIG[config.next].label}. You can revert to Draft later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onTransition(config.next!)}>
                  {config.nextLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}
