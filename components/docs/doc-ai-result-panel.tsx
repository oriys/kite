'use client'

import { Check, RefreshCw, X } from 'lucide-react'

import {
  AI_ACTION_LABELS,
  isAiAppendResultAction,
  isAiRewriteAction,
  type AiTransformAction,
} from '@/lib/ai'
import { type DocEditorAiPanelSide } from '@/lib/doc-editor-layout'
import { cn } from '@/lib/utils'
import { DocAiGlyph } from '@/components/docs/doc-ai-glyph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownPreview } from '@/components/docs/markdown-preview'

interface DocAiResultPanelProps {
  scope: 'selection' | 'document'
  action: AiTransformAction
  resultText: string
  modelLabel: string
  modelId: string
  targetLanguage?: string
  customPrompt?: string
  pending?: boolean
  previewOnly?: boolean
  onRetry: () => void
  onAccept: () => void
  side?: DocEditorAiPanelSide
  onClose: () => void
}

export function DocAiResultPanel({
  scope,
  action,
  resultText,
  modelLabel,
  modelId,
  targetLanguage,
  customPrompt,
  pending,
  previewOnly = false,
  onRetry,
  onAccept,
  side = 'right',
  onClose,
}: DocAiResultPanelProps) {
  const documentTitle =
    action === 'review'
      ? 'Document review'
      : action === 'score'
        ? 'Document scorecard'
        : action === 'summarize'
          ? 'Executive summary'
          : action === 'outline'
            ? 'Document outline'
            : action === 'checklist'
              ? 'Action checklist'
              : 'Full-document draft'

  const description =
    previewOnly
      ? 'Preview the AI output here. This document is read-only in its current status, so applying changes is disabled.'
      : scope === 'document' && isAiRewriteAction(action)
        ? 'Review the AI rewrite here. Accepting it will replace the current document.'
        : scope === 'document' && isAiAppendResultAction(action)
          ? 'Review the AI report here. Accepting it will append the result to the end of the document.'
          : 'Reviewing only the AI output. The original stays visible in the editor.'

  const acceptLabel =
    action === 'explain'
      ? 'Insert explanation'
      : scope === 'document' && action === 'review'
        ? 'Append review'
        : scope === 'document' && action === 'score'
          ? 'Append scorecard'
          : scope === 'document' && action === 'summarize'
            ? 'Append summary'
            : scope === 'document' && action === 'outline'
              ? 'Append outline'
              : scope === 'document' && action === 'checklist'
                ? 'Append checklist'
      : scope === 'document'
        ? 'Replace document'
        : 'Replace selection'

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden border-t border-border/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.03),transparent_24%)] xl:border-t-0',
        side === 'left' ? 'xl:border-r' : 'xl:border-l',
      )}
    >
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              AI Result
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              {scope === 'document' ? documentTitle : 'Selection draft'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onClose}
            disabled={pending}
            aria-label="Close AI result"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{AI_ACTION_LABELS[action]}</Badge>
          <Badge variant="outline">{modelLabel}</Badge>
          {targetLanguage ? <Badge variant="outline">{targetLanguage}</Badge> : null}
          <Badge variant="outline" className="max-w-full truncate" title={modelId}>
            {modelId}
          </Badge>
          {previewOnly ? <Badge variant="secondary">Preview only</Badge> : null}
          <Badge variant={pending ? 'secondary' : 'outline'}>
            <DocAiGlyph className={cn('size-[0.8rem]', pending && 'animate-pulse')} />
            {pending ? 'Refreshing' : 'Ready'}
          </Badge>
        </div>
        {customPrompt ? (
          <div className="mt-3 rounded-lg border border-border/75 bg-muted/35 px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Prompt
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {customPrompt}
            </p>
          </div>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 py-5">
          <MarkdownPreview
            content={resultText}
            className="prose-editorial max-w-none text-[15px] leading-7"
          />
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 bg-background/92 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Dismiss
          </Button>
          <Button variant="outline" onClick={onRetry} disabled={pending}>
            <RefreshCw className={pending ? 'animate-spin' : undefined} />
            {pending ? 'Retrying…' : 'Retry'}
          </Button>
          {!previewOnly ? (
            <Button onClick={onAccept} disabled={pending}>
              <Check />
              {acceptLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
