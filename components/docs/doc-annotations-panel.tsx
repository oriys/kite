'use client'

import * as React from 'react'
import {
  CheckCheck,
  Loader2,
  Quote,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  type DocActor,
  type DocAnnotation,
  type DocAnnotationStatus,
  type DocEvaluation,
  type DocEvaluationScore,
} from '@/lib/documents'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

interface DocReviewPanelProps {
  evaluations: DocEvaluation[]
  evaluationsLoading?: boolean
  evaluationsError?: string | null
  onCreateEvaluation: (input: {
    score: DocEvaluationScore
    body: string
  }) => Promise<DocEvaluation | null>
  onDeleteEvaluation: (evaluationId: string) => Promise<boolean>
  annotations: DocAnnotation[]
  annotationsLoading?: boolean
  annotationsError?: string | null
  onCaptureSelection: () => string
  onCreateAnnotation: (input: {
    body: string
    quote?: string
  }) => Promise<DocAnnotation | null>
  onUpdateAnnotation: (
    annotationId: string,
    patch: {
      body?: string
      status?: DocAnnotationStatus
    },
  ) => Promise<DocAnnotation | null>
  onDeleteAnnotation: (annotationId: string) => Promise<boolean>
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

function getActorName(input: {
  creator: DocActor | null
  createdBy: string | null
}) {
  return (
    input.creator?.name ||
    input.creator?.email ||
    (input.createdBy ? 'Workspace member' : 'Former member')
  )
}

function getActorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function SectionHeader({
  title,
  meta,
}: {
  title: string
  meta?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      {meta}
    </div>
  )
}

function RatingStars({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < score
        return (
          <Star
            key={index}
            className={cn(
              'size-3.5',
              filled
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/30',
            )}
          />
        )
      })}
    </div>
  )
}

function EvaluationCard({
  evaluation,
  busy,
  onDelete,
}: {
  evaluation: DocEvaluation
  busy: boolean
  onDelete: (evaluation: DocEvaluation) => Promise<void>
}) {
  const actorName = getActorName(evaluation)

  return (
    <article className="space-y-3 rounded-xl border border-border/65 bg-background/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8 border border-border/70">
            <AvatarImage src={evaluation.creator?.image ?? undefined} alt={actorName} />
            <AvatarFallback className="text-[11px] font-semibold text-muted-foreground">
              {getActorInitials(actorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{actorName}</p>
            <p className="text-xs text-muted-foreground">
              {timeAgo(evaluation.createdAt)}
              {evaluation.updatedAt !== evaluation.createdAt ? ' · edited' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/25 px-2.5 py-1">
          <RatingStars score={evaluation.score} className="gap-0.5" />
          <span className="text-xs font-medium text-foreground">{evaluation.score}/5</span>
        </div>
      </div>

      <p className="text-sm leading-6 text-foreground">{evaluation.body}</p>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => void onDelete(evaluation)}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="mr-1.5 size-3 animate-spin" />
        ) : (
          <Trash2 className="mr-1.5 size-3" />
        )}
        Delete
      </Button>
    </article>
  )
}

function AnnotationCard({
  annotation,
  busy,
  onToggleStatus,
  onDelete,
}: {
  annotation: DocAnnotation
  busy: boolean
  onToggleStatus: (annotation: DocAnnotation) => Promise<void>
  onDelete: (annotation: DocAnnotation) => Promise<void>
}) {
  const actorName = getActorName(annotation)

  return (
    <article
      className={cn(
        'space-y-3 rounded-xl border border-border/65 bg-background/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]',
        annotation.status === 'resolved' && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8 border border-border/70">
            <AvatarImage src={annotation.creator?.image ?? undefined} alt={actorName} />
            <AvatarFallback className="text-[11px] font-semibold text-muted-foreground">
              {getActorInitials(actorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{actorName}</p>
            <p className="text-xs text-muted-foreground">
              {timeAgo(annotation.createdAt)}
              {annotation.updatedAt !== annotation.createdAt ? ' · edited' : ''}
            </p>
          </div>
        </div>
        <Badge variant={annotation.status === 'open' ? 'default' : 'outline'}>
          {annotation.status === 'open' ? 'Open' : 'Resolved'}
        </Badge>
      </div>

      {annotation.quote ? (
        <div className="rounded-lg border border-dashed border-border/75 bg-muted/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Quote className="size-3.5" />
            Selected text
          </div>
          <p className="text-sm leading-6 text-foreground/85">{annotation.quote}</p>
        </div>
      ) : null}

      <p className="text-sm leading-6 text-foreground">{annotation.body}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => void onToggleStatus(annotation)}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="mr-1.5 size-3 animate-spin" />
          ) : annotation.status === 'open' ? (
            <CheckCheck className="mr-1.5 size-3" />
          ) : (
            <RotateCcw className="mr-1.5 size-3" />
          )}
          {annotation.status === 'open' ? 'Resolve' : 'Reopen'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => void onDelete(annotation)}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="mr-1.5 size-3 animate-spin" />
          ) : (
            <Trash2 className="mr-1.5 size-3" />
          )}
          Delete
        </Button>
      </div>
    </article>
  )
}

function LoadingStack() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border border-border/65 bg-background/80 p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  )
}

export function DocReviewPanel({
  evaluations,
  evaluationsLoading = false,
  evaluationsError,
  onCreateEvaluation,
  onDeleteEvaluation,
  annotations,
  annotationsLoading = false,
  annotationsError,
  onCaptureSelection,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  className,
}: DocReviewPanelProps) {
  const [evaluationScore, setEvaluationScore] =
    React.useState<DocEvaluationScore>(4)
  const [evaluationBody, setEvaluationBody] = React.useState('')
  const [evaluationSubmitting, setEvaluationSubmitting] = React.useState(false)
  const [busyEvaluationId, setBusyEvaluationId] = React.useState<string | null>(null)
  const [annotationBody, setAnnotationBody] = React.useState('')
  const [annotationQuote, setAnnotationQuote] = React.useState('')
  const [annotationSubmitting, setAnnotationSubmitting] = React.useState(false)
  const [busyAnnotationId, setBusyAnnotationId] = React.useState<string | null>(null)

  const openAnnotations = React.useMemo(
    () => annotations.filter((annotation) => annotation.status === 'open'),
    [annotations],
  )
  const resolvedAnnotations = React.useMemo(
    () => annotations.filter((annotation) => annotation.status === 'resolved'),
    [annotations],
  )
  const averageScore = React.useMemo(() => {
    if (evaluations.length === 0) return null
    const total = evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0)
    return total / evaluations.length
  }, [evaluations])

  const handleCaptureSelection = React.useCallback(() => {
    const nextQuote = onCaptureSelection()

    if (!nextQuote) {
      toast.error('Select text first', {
        description:
          'Highlight the relevant text in the editor, then capture it as an annotation excerpt.',
      })
      return
    }

    setAnnotationQuote(nextQuote)
    toast.success('Selection captured', {
      description: 'The selected text is attached to the next annotation.',
    })
  }, [onCaptureSelection])

  const handleCreateEvaluation = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const nextBody = evaluationBody.trim()
      if (!nextBody) {
        toast.error('Evaluation text is required')
        return
      }

      setEvaluationSubmitting(true)

      try {
        await onCreateEvaluation({
          score: evaluationScore,
          body: nextBody,
        })
        setEvaluationBody('')
        setEvaluationScore(4)
        toast.success('Evaluation added')
      } catch (error) {
        toast.error('Failed to add evaluation', {
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      } finally {
        setEvaluationSubmitting(false)
      }
    },
    [evaluationBody, evaluationScore, onCreateEvaluation],
  )

  const handleDeleteEvaluation = React.useCallback(
    async (evaluation: DocEvaluation) => {
      setBusyEvaluationId(evaluation.id)

      try {
        await onDeleteEvaluation(evaluation.id)
      } catch (error) {
        toast.error('Failed to delete evaluation', {
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      } finally {
        setBusyEvaluationId(null)
      }
    },
    [onDeleteEvaluation],
  )

  const handleCreateAnnotation = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const nextBody = annotationBody.trim()
      if (!nextBody) {
        toast.error('Annotation text is required')
        return
      }

      setAnnotationSubmitting(true)

      try {
        await onCreateAnnotation({
          body: nextBody,
          quote: annotationQuote || undefined,
        })
        setAnnotationBody('')
        setAnnotationQuote('')
        toast.success('Annotation added')
      } catch (error) {
        toast.error('Failed to add annotation', {
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      } finally {
        setAnnotationSubmitting(false)
      }
    },
    [annotationBody, annotationQuote, onCreateAnnotation],
  )

  const handleToggleAnnotationStatus = React.useCallback(
    async (annotation: DocAnnotation) => {
      setBusyAnnotationId(annotation.id)

      try {
        await onUpdateAnnotation(annotation.id, {
          status: annotation.status === 'open' ? 'resolved' : 'open',
        })
      } catch (error) {
        toast.error('Failed to update annotation', {
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      } finally {
        setBusyAnnotationId(null)
      }
    },
    [onUpdateAnnotation],
  )

  const handleDeleteAnnotation = React.useCallback(
    async (annotation: DocAnnotation) => {
      setBusyAnnotationId(annotation.id)

      try {
        await onDeleteAnnotation(annotation.id)
      } catch (error) {
        toast.error('Failed to delete annotation', {
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      } finally {
        setBusyAnnotationId(null)
      }
    },
    [onDeleteAnnotation],
  )

  return (
    <aside
      className={cn(
        'flex min-h-[420px] flex-col overflow-hidden rounded-md border border-border/75 bg-card/95 xl:h-full',
        className,
      )}
    >
      <div className="border-b border-border/60 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Review
            </p>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Evaluation and annotations
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{evaluations.length} ratings</Badge>
            <Badge variant="outline">{openAnnotations.length} open</Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          <section className="space-y-4">
            <SectionHeader
              title="Evaluation"
              meta={
                averageScore === null ? (
                  <Badge variant="outline">No scores yet</Badge>
                ) : (
                  <div className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/25 px-2.5 py-1">
                    <RatingStars score={Math.round(averageScore)} className="gap-0.5" />
                    <span className="text-xs font-medium text-foreground">
                      {averageScore.toFixed(1)}/5
                    </span>
                  </div>
                )
              }
            />

            <div className="rounded-xl border border-border/65 bg-background/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Overall score
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                    {averageScore === null ? '—' : averageScore.toFixed(1)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {evaluations.length} {evaluations.length === 1 ? 'evaluation' : 'evaluations'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {averageScore === null
                      ? 'Add the first review score for this document.'
                      : 'Average across all submitted evaluations.'}
                  </p>
                </div>
              </div>
            </div>

            <form className="space-y-3" onSubmit={handleCreateEvaluation}>
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Select score
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {([1, 2, 3, 4, 5] as const).map((score) => (
                    <button
                      key={score}
                      type="button"
                      className={cn(
                        'flex h-10 items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors',
                        evaluationScore === score
                          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300'
                          : 'border-border/70 bg-background/80 text-muted-foreground hover:border-border hover:text-foreground',
                      )}
                      onClick={() => setEvaluationScore(score)}
                      disabled={evaluationSubmitting}
                    >
                      <Star
                        className={cn(
                          'size-3.5',
                          evaluationScore >= score
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-current/50',
                        )}
                      />
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                value={evaluationBody}
                onChange={(event) => setEvaluationBody(event.target.value)}
                placeholder="Summarize overall document quality, clarity, structure, and what should improve."
                className="min-h-24 resize-y"
                disabled={evaluationSubmitting}
              />

              <Button
                type="submit"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={evaluationSubmitting}
              >
                {evaluationSubmitting ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : null}
                Add evaluation
              </Button>
            </form>

            {evaluationsError ? (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                {evaluationsError}
              </div>
            ) : null}

            {evaluationsLoading ? (
              <LoadingStack />
            ) : evaluations.length === 0 && !evaluationsError ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-5 text-sm text-muted-foreground">
                No evaluations yet. Add a score and a short summary for the document.
              </div>
            ) : !evaluationsError ? (
              <div className="space-y-3">
                {evaluations.map((evaluation) => (
                  <EvaluationCard
                    key={evaluation.id}
                    evaluation={evaluation}
                    busy={busyEvaluationId === evaluation.id}
                    onDelete={handleDeleteEvaluation}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-4 border-t border-border/60 pt-6">
            <SectionHeader
              title="Annotations"
              meta={<Badge variant="outline">{openAnnotations.length} open</Badge>}
            />

            <form className="space-y-3" onSubmit={handleCreateAnnotation}>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={handleCaptureSelection}
                  disabled={annotationSubmitting}
                >
                  Capture selection
                </Button>
                {annotationQuote ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => setAnnotationQuote('')}
                    disabled={annotationSubmitting}
                  >
                    Clear excerpt
                  </Button>
                ) : null}
              </div>

              {annotationQuote ? (
                <div className="rounded-lg border border-dashed border-border/75 bg-muted/25 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Next excerpt
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground/85">
                    {annotationQuote}
                  </p>
                </div>
              ) : null}

              <Textarea
                value={annotationBody}
                onChange={(event) => setAnnotationBody(event.target.value)}
                placeholder="Add a review note, request, or context for a specific part of the document."
                className="min-h-24 resize-y"
                disabled={annotationSubmitting}
              />

              <Button
                type="submit"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={annotationSubmitting}
              >
                {annotationSubmitting ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : null}
                Add annotation
              </Button>
            </form>

            {annotationsError ? (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                {annotationsError}
              </div>
            ) : null}

            {annotationsLoading ? (
              <LoadingStack />
            ) : annotations.length === 0 && !annotationsError ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-5 text-sm text-muted-foreground">
                No annotations yet. Capture selected text from the editor or add a general review note.
              </div>
            ) : !annotationsError ? (
              <>
                <div className="space-y-3">
                  <SectionHeader
                    title="Open"
                    meta={<Badge variant="outline">{openAnnotations.length}</Badge>}
                  />
                  {openAnnotations.length > 0 ? (
                    <div className="space-y-3">
                      {openAnnotations.map((annotation) => (
                        <AnnotationCard
                          key={annotation.id}
                          annotation={annotation}
                          busy={busyAnnotationId === annotation.id}
                          onToggleStatus={handleToggleAnnotationStatus}
                          onDelete={handleDeleteAnnotation}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No open annotations.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <SectionHeader
                    title="Resolved"
                    meta={<Badge variant="outline">{resolvedAnnotations.length}</Badge>}
                  />
                  {resolvedAnnotations.length > 0 ? (
                    <div className="space-y-3">
                      {resolvedAnnotations.map((annotation) => (
                        <AnnotationCard
                          key={annotation.id}
                          annotation={annotation}
                          busy={busyAnnotationId === annotation.id}
                          onToggleStatus={handleToggleAnnotationStatus}
                          onDelete={handleDeleteAnnotation}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Resolved annotations appear here.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </div>
      </ScrollArea>
    </aside>
  )
}
