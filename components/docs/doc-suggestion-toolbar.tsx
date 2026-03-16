'use client'

import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { suggestionStats, type SuggestionReviewState } from '@/lib/suggestions'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'

interface DocSuggestionToolbarProps {
  state: SuggestionReviewState
  onAcceptCurrent: () => void
  onRejectCurrent: () => void
  onAcceptAll: () => void
  onRejectAll: () => void
  onGoNext: () => void
  onGoPrev: () => void
  onClose: () => void
  onCancelAiLoading?: () => void
}

const TOOLBAR_CLASSES = cn(
  'fixed bottom-4 left-1/2 z-50 -translate-x-1/2',
  'flex items-center gap-1 px-2 py-1.5',
  'rounded-lg border border-border/70',
  'bg-card/95 backdrop-blur-sm',
  'shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]',
  'dark:shadow-[0_2px_12px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.2)]',
)

export function DocSuggestionToolbar({
  state,
  onAcceptCurrent,
  onRejectCurrent,
  onAcceptAll,
  onRejectAll,
  onGoNext,
  onGoPrev,
  onClose,
  onCancelAiLoading,
}: DocSuggestionToolbarProps) {
  const reducedMotion = useReducedMotion()
  const isVisible = state.active || !!state.aiLoading

  return (
    <AnimatePresence>
      {isVisible && (
        <TooltipProvider delayDuration={300}>
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="toolbar"
            aria-label={state.aiLoading ? 'AI processing' : 'Suggestion review toolbar'}
            className={TOOLBAR_CLASSES}
          >
            {state.aiLoading ? (
              <AiLoadingContent
                actionLabel={state.aiLoading.actionLabel}
                modelLabel={state.aiLoading.modelLabel}
                onCancel={onCancelAiLoading}
              />
            ) : (
              <ReviewContent
                state={state}
                onAcceptCurrent={onAcceptCurrent}
                onRejectCurrent={onRejectCurrent}
                onAcceptAll={onAcceptAll}
                onRejectAll={onRejectAll}
                onGoNext={onGoNext}
                onGoPrev={onGoPrev}
                onClose={onClose}
              />
            )}
          </motion.div>
        </TooltipProvider>
      )}
    </AnimatePresence>
  )
}

// ── AI Loading variant ──────────────────────────────────────────

function AiLoadingContent({
  actionLabel,
  modelLabel,
  onCancel,
}: {
  actionLabel: string
  modelLabel: string
  onCancel?: () => void
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-2">
        <Sparkles className="size-3.5 text-primary animate-pulse" />
        <span className="text-xs font-medium text-foreground">
          {actionLabel}
        </span>
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      <span className="max-w-[10rem] truncate px-1.5 text-[11px] text-muted-foreground">
        {modelLabel}
      </span>

      {onCancel && (
        <>
          <Separator orientation="vertical" className="mx-0.5 h-5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onCancel}
                className="size-8 text-muted-foreground hover:text-foreground"
                aria-label="Cancel AI action"
              >
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="flex items-center gap-2">
              Cancel <Kbd>Esc</Kbd>
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </>
  )
}

// ── Review variant ──────────────────────────────────────────────

function ReviewContent({
  state,
  onAcceptCurrent,
  onRejectCurrent,
  onAcceptAll,
  onRejectAll,
  onGoNext,
  onGoPrev,
  onClose,
}: {
  state: SuggestionReviewState
  onAcceptCurrent: () => void
  onRejectCurrent: () => void
  onAcceptAll: () => void
  onRejectAll: () => void
  onGoNext: () => void
  onGoPrev: () => void
  onClose: () => void
}) {
  const stats = suggestionStats(state)
  const current = state.suggestions[state.currentIndex]
  const currentIsActive = current?.status === 'pending'
  const noPending = stats.pending === 0

  // 1-based display index among pending suggestions
  const pendingIndices = state.suggestions
    .map((s, i) => (s.status === 'pending' ? i : -1))
    .filter((i) => i >= 0)
  const displayIndex = pendingIndices.indexOf(state.currentIndex) + 1

  return (
    <>
      {/* Close */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Close review"
          >
            <X className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="flex items-center gap-2">
          Close review <Kbd>Esc</Kbd>
        </TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Reject All */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRejectAll}
            disabled={noPending}
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <XCircle className="size-3.5" />
            <span className="hidden sm:inline">Reject All</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Reject all remaining suggestions
        </TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Navigation */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onGoPrev}
            disabled={noPending}
            className="size-8"
            aria-label="Previous suggestion"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="flex items-center gap-2">
          Previous <Kbd>Shift+Tab</Kbd>
        </TooltipContent>
      </Tooltip>

      {/* Counter */}
      <div
        className="min-w-[5rem] text-center text-xs font-medium tabular-nums text-foreground"
        aria-live="polite"
        aria-atomic="true"
      >
        {noPending ? (
          <span className="text-muted-foreground">All reviewed</span>
        ) : (
          <>
            <span className="text-foreground">{displayIndex}</span>
            <span className="text-muted-foreground"> / {stats.pending}</span>
            <span className="ml-1.5 text-[10px] text-muted-foreground/70">
              suggestions
            </span>
          </>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onGoNext}
            disabled={noPending}
            className="size-8"
            aria-label="Next suggestion"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="flex items-center gap-2">
          Next <Kbd>Tab</Kbd>
        </TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Accept All */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAcceptAll}
            disabled={noPending}
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <CheckCheck className="size-3.5" />
            <span className="hidden sm:inline">Accept All</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Accept all remaining suggestions
        </TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Reject Current */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onRejectCurrent}
            disabled={!currentIsActive}
            className="h-8 gap-1.5 border-border/60 px-3 text-xs"
          >
            <X className="size-3.5" />
            <span className="hidden sm:inline">Reject</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="flex items-center gap-2">
          Reject current <Kbd>N</Kbd>
        </TooltipContent>
      </Tooltip>

      {/* Accept Current */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            onClick={onAcceptCurrent}
            disabled={!currentIsActive}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Check className="size-3.5" />
            <span className="hidden sm:inline">Accept</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="flex items-center gap-2">
          Accept current <Kbd>Y</Kbd>
        </TooltipContent>
      </Tooltip>
    </>
  )
}
