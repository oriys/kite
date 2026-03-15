import * as React from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { Sparkles } from 'lucide-react'
import { AI_ACTION_LABELS, MAX_AI_CUSTOM_PROMPT_LENGTH } from '@/lib/ai'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

// ── Custom AI Prompt Dialog ────────────────────────────────────────────────

export interface CustomAiPromptDialogProps {
  open: boolean
  selectionText: string
  promptValue: string
  modelLabel: string | null
  onPromptChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}

export function CustomAiPromptDialog({
  open,
  selectionText,
  promptValue,
  modelLabel,
  onPromptChange,
  onClose,
  onSubmit,
}: CustomAiPromptDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => { if (!isOpen) onClose() }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{AI_ACTION_LABELS.custom}</DialogTitle>
          <DialogDescription>
            Describe exactly how the selected text should be transformed. The result still opens in preview first.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {modelLabel ?? 'No AI enabled'}
          </Badge>
          <Badge variant="outline">{selectionText.length} selected characters</Badge>
        </div>

        <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Selected text
          </p>
          <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
            {selectionText}
          </p>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="custom-ai-prompt">Prompt</FieldLabel>
            <FieldContent>
              <Textarea
                id="custom-ai-prompt"
                value={promptValue}
                onChange={(event) => onPromptChange(event.target.value)}
                className="min-h-36 leading-6"
                placeholder="Example: Rewrite this into a concise changelog for release notes, keep all technical terms and bullet structure."
                maxLength={MAX_AI_CUSTOM_PROMPT_LENGTH}
                autoFocus
              />
              <FieldDescription>
                Be explicit about tone, format, constraints, or what should stay unchanged.
                {` ${promptValue.length} / ${MAX_AI_CUSTOM_PROMPT_LENGTH}`}
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!promptValue.trim()}>
            <Sparkles data-icon="inline-start" />
            Run prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Link Input Dialog ──────────────────────────────────────────────────────

export interface LinkInputDialogProps {
  open: boolean
  url: string
  onUrlChange: (url: string) => void
  onClose: () => void
  onSubmit: () => void
}

export function LinkInputDialog({
  open,
  url,
  onUrlChange,
  onClose,
  onSubmit,
}: LinkInputDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
          <DialogDescription>Enter the URL for this link.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
          <input
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com"
            autoFocus
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!url.trim()}>
              Insert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Floating Stats Pill ────────────────────────────────────────────────────

export interface FloatingStatsPillProps {
  editor: Editor
  selectionInfo: { words: number; chars: number } | null
  statsOverlayContainerRef?: React.RefObject<HTMLDivElement | null>
}

export function FloatingStatsPill({
  editor,
  selectionInfo,
  statsOverlayContainerRef,
}: FloatingStatsPillProps) {
  const content = (
    <div
      className={cn(
        'pointer-events-none absolute right-4 bottom-4 z-30 flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-[10px] font-medium shadow-sm backdrop-blur-sm sm:right-5 sm:bottom-5',
        selectionInfo
          ? 'bg-background/90 text-muted-foreground animate-in fade-in slide-in-from-bottom-2'
          : 'bg-background/80 text-muted-foreground/60',
      )}
    >
      {selectionInfo ? (
        <>
          <span>
            {selectionInfo.words}{' '}
            {selectionInfo.words === 1 ? 'word' : 'words'}
          </span>
          <span className="opacity-40">/</span>
          <span>
            {selectionInfo.chars}{' '}
            {selectionInfo.chars === 1 ? 'char' : 'chars'}
          </span>
        </>
      ) : (
        <>
          <span>{editor.storage.characterCount?.characters() ?? 0} chars</span>
          <span className="opacity-40">/</span>
          <span>{editor.storage.characterCount?.words() ?? 0} words</span>
        </>
      )}
    </div>
  )

  if (statsOverlayContainerRef?.current) {
    return createPortal(content, statsOverlayContainerRef.current)
  }
  return content
}
