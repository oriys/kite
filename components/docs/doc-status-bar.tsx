'use client'

import {
  ArrowLeft,
  RotateCcw,
  Clock,
  FileText,
  ChevronRight,
  Trash2,
  Copy,
  Check,
  Loader2,
  MessageSquareQuote,
  Star,
} from 'lucide-react'
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

export type SaveState = 'idle' | 'saving' | 'saved'

interface DocStatusBarProps {
  doc: Doc
  openAnnotationCount?: number
  averageEvaluationScore?: number | null
  evaluationCount?: number
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

export function DocStatusBar({
  doc,
  openAnnotationCount = 0,
  averageEvaluationScore = null,
  evaluationCount = 0,
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
          {wc.toLocaleString()} {wc === 1 ? 'word' : 'words'}
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

        {doc.versions.length > 0 && (
          <span className="text-muted-foreground/70">
            {doc.versions.length} {doc.versions.length === 1 ? 'revision' : 'revisions'}
          </span>
        )}

        <span className="flex items-center gap-1 text-muted-foreground/70">
          <MessageSquareQuote className="size-3" />
          {openAnnotationCount} open {openAnnotationCount === 1 ? 'annotation' : 'annotations'}
        </span>

        <span className="flex items-center gap-1 text-muted-foreground/70">
          <Star
            className={cn(
              'size-3',
              averageEvaluationScore === null
                ? 'text-muted-foreground/50'
                : 'fill-amber-400 text-amber-400',
            )}
          />
          {averageEvaluationScore === null
            ? 'No ratings'
            : `${averageEvaluationScore.toFixed(1)}/5 · ${evaluationCount} ${evaluationCount === 1 ? 'rating' : 'ratings'}`}
        </span>
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
