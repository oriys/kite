'use client'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Loader2,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import { type Doc, type DocStatus, STATUS_CONFIG, wordCount } from '@/lib/documents'
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

export type SaveState = 'idle' | 'saving' | 'saved'

interface DocStatusBarProps {
  doc: Doc
  backBusy?: boolean
  saveState?: SaveState
  onBack?: () => void
  onTransition: (status: DocStatus) => void
  onDelete: () => void
  onDuplicate: () => void
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

export function DocStatusBar({
  doc,
  backBusy = false,
  saveState = 'idle',
  onBack,
  onTransition,
  onDelete,
  onDuplicate,
  className,
}: DocStatusBarProps) {
  const router = useRouter()
  const config = STATUS_CONFIG[doc.status]
  const wc = wordCount(doc.content)
  const recentVersions = doc.versions.slice(0, 6)

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
          ) : (
            <>
              <Clock className="size-3" />
              Saved {timeAgo(doc.updatedAt)}
            </>
          )}
        </span>

        {doc.versions.length > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground/80 transition-colors hover:bg-muted/45 hover:text-foreground"
              >
                <span>{doc.versions.length}</span>
                <span>{doc.versions.length === 1 ? 'revision' : 'revisions'}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-1.5">
              <div className="border-b border-border/70 px-3 py-2">
                <p className="text-sm font-medium text-foreground">Recent revisions</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Quick snapshots from autosave. Open a card to compare content next.
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {recentVersions.map((version, index) => (
                  <div
                    key={version.id}
                    className={cn(
                      'space-y-1.5 px-3 py-2.5',
                      index > 0 && 'border-t border-border/60',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {timeAgo(version.savedAt)}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {version.wordCount.toLocaleString()} words
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-foreground/90">
                      {summarizeVersion(version.content)}
                    </p>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        {/* Revert to draft (from review/published/archived) */}
        {doc.status !== 'draft' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => onTransition('draft')}
          >
            <RotateCcw className="mr-1.5 size-3" />
            Revert to Draft
          </Button>
        )}

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 size-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Primary lifecycle action */}
        {config.next && config.nextLabel && (
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
