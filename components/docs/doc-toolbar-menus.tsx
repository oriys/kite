'use client'

import * as React from 'react'
import {
  BadgeCheck,
  ChevronDown,
  ClipboardList,
  Columns2,
  FileCode,
  FileSearch,
  FileText,
  Languages,
  ListOrdered,
  Loader2,
  Minus,
  PenLine,
  Plus,
  Sparkles,
} from 'lucide-react'
import { AI_ACTION_LABELS, type AiTransformAction } from '@/lib/ai'
import { CODE_LANGUAGE_OPTIONS, type CodeLanguageOption } from '@/lib/code-highlighting'
import { cn } from '@/lib/utils'
import {
  type EditorViewMode,
  AI_PENDING_LABELS,
  DOCUMENT_TRANSLATE_LANGUAGES,
  DEFAULT_DOCUMENT_AI_ACTIONS,
  DOCUMENT_REWRITE_ACTIONS,
  DOCUMENT_REVIEW_ACTIONS,
} from '@/components/docs/doc-toolbar-helpers'
import { DocAiGlyph } from '@/components/docs/doc-ai-glyph'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ── Editor mode menu ────────────────────────────────────────────────────────

interface EditorModeOption {
  value: EditorViewMode
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const EDITOR_MODE_OPTIONS: EditorModeOption[] = [
  {
    value: 'wysiwyg',
    label: 'Edit',
    icon: PenLine,
  },
  {
    value: 'source',
    label: 'Markdown',
    icon: FileCode,
  },
  {
    value: 'split',
    label: 'Split View',
    icon: Columns2,
  },
]

export interface EditorModeMenuProps {
  value: EditorViewMode
  onChange: (mode: EditorViewMode) => void
}

export function EditorModeMenu({ value, onChange }: EditorModeMenuProps) {
  const activeIndex = EDITOR_MODE_OPTIONS.findIndex((option) => option.value === value)
  const normalizedIndex = activeIndex === -1 ? 0 : activeIndex
  const activeMode = EDITOR_MODE_OPTIONS[normalizedIndex]
  const nextMode = EDITOR_MODE_OPTIONS[(normalizedIndex + 1) % EDITOR_MODE_OPTIONS.length]
  const ActiveIcon = activeMode.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-background/80 hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(nextMode.value)}
          aria-label={`Current view: ${activeMode.label}. Switch to ${nextMode.label}.`}
        >
          <ActiveIcon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {activeMode.label}
        {' -> '}
        {nextMode.label}
      </TooltipContent>
    </Tooltip>
  )
}

// ── Code block menu ─────────────────────────────────────────────────────────

export interface CodeBlockMenuProps {
  disabled?: boolean
  onBeforeOpen?: () => void
  onSelect: (language: CodeLanguageOption) => void
}

export function CodeBlockMenu({ disabled, onBeforeOpen, onSelect }: CodeBlockMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                onBeforeOpen?.()
              }}
              aria-label="Insert code block"
            >
              <FileCode className="size-3.5" />
              <span>Code</span>
              <ChevronDown className="size-3 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Code Block
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side="bottom" className="w-56">
        <DropdownMenuLabel>Insert code block</DropdownMenuLabel>
        {CODE_LANGUAGE_OPTIONS.map((language) => (
          <DropdownMenuItem key={language.value} onSelect={() => onSelect(language)}>
            <span>{language.label}</span>
            <DropdownMenuShortcut>{language.hint}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Document AI menu item content ───────────────────────────────────────────

interface DocumentAiMenuItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  shortcut?: string
}

function DocumentAiMenuItemContent({
  icon: Icon,
  label,
  description,
  shortcut,
}: DocumentAiMenuItemProps) {
  return (
    <>
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/55 bg-muted/20 text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block truncate text-[13px] font-medium text-foreground">{label}</span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
          {description}
        </span>
      </span>
      {shortcut ? <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut> : null}
    </>
  )
}

// ── Document AI menu ────────────────────────────────────────────────────────

export interface DocumentAiMenuProps {
  activeAiLabel?: string | null
  aiDisabled?: boolean
  availableDocumentAiActions?: readonly AiTransformAction[]
  aiDocumentPendingAction?: AiTransformAction | null
  onAiDocumentAction?: (
    action: AiTransformAction,
    options?: { targetLanguage?: string },
  ) => void
}

export function DocumentAiMenu({
  activeAiLabel,
  aiDisabled,
  availableDocumentAiActions,
  aiDocumentPendingAction,
  onAiDocumentAction,
}: DocumentAiMenuProps) {
  const documentAiActions = availableDocumentAiActions ?? DEFAULT_DOCUMENT_AI_ACTIONS
  const availableDocumentAiActionSet = new Set<AiTransformAction>(documentAiActions)
  const showRewriteActions = DOCUMENT_REWRITE_ACTIONS.some((action) =>
    availableDocumentAiActionSet.has(action),
  )
  const showReviewActions = DOCUMENT_REVIEW_ACTIONS.some((action) =>
    availableDocumentAiActionSet.has(action),
  )
  const canUseDocumentAi =
    documentAiActions.length > 0 && !aiDisabled && Boolean(onAiDocumentAction)
  const isDocumentAiWorking = Boolean(aiDocumentPendingAction)
  const documentAiButtonLabel = aiDocumentPendingAction
    ? `${AI_PENDING_LABELS[aiDocumentPendingAction]}…`
    : 'AI Actions'

  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!canUseDocumentAi}
              className={cn(
                'relative h-8 gap-2 overflow-hidden px-2.5 text-xs disabled:opacity-100',
                isDocumentAiWorking &&
                  'border-accent/50 bg-accent/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_0_0_1px_rgba(15,23,42,0.03)]',
              )}
              onMouseDown={(e) => e.preventDefault()}
            >
              {isDocumentAiWorking ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 animate-pulse bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.14),transparent)] motion-reduce:animate-none"
                />
              ) : null}
              <DocAiGlyph
                className={cn(
                  'relative size-3.5',
                  isDocumentAiWorking &&
                    'animate-[pulse_1.6s_cubic-bezier(0.22,1,0.36,1)_infinite] motion-reduce:animate-none',
                )}
              />
              <span className="relative">{documentAiButtonLabel}</span>
              {isDocumentAiWorking ? (
                <Loader2 className="relative size-3 animate-spin text-muted-foreground motion-reduce:animate-none" />
              ) : (
                <ChevronDown className="relative size-3 opacity-70" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isDocumentAiWorking
            ? `${documentAiButtonLabel}${activeAiLabel ? ` with ${activeAiLabel}` : ''}`
            : activeAiLabel
              ? `Run full-document AI actions with ${activeAiLabel}`
              : 'Run full-document AI actions'}
        </TooltipContent>
      </Tooltip>
        <DropdownMenuContent align="end" side="bottom" className="w-80 rounded-xl p-1.5">
          <DropdownMenuLabel className="pb-1.5">
            <div className="flex items-center gap-2">
              <DocAiGlyph className="size-3.5" />
              <span>Full-document AI</span>
            </div>
          </DropdownMenuLabel>

          {showRewriteActions ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Rewrite
              </DropdownMenuLabel>
              {availableDocumentAiActionSet.has('polish') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('polish')}
                >
                  <DocumentAiMenuItemContent
                    icon={Sparkles}
                    label={AI_ACTION_LABELS.polish}
                    description="Refine clarity and tone."
                    shortcut="Replace"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('autofix') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('autofix')}
                >
                  <DocumentAiMenuItemContent
                    icon={BadgeCheck}
                    label={AI_ACTION_LABELS.autofix}
                    description="Fix spelling and formatting only."
                    shortcut="Replace"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('shorten') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('shorten')}
                >
                  <DocumentAiMenuItemContent
                    icon={Minus}
                    label={AI_ACTION_LABELS.shorten}
                    description="Trim repetition."
                    shortcut="Replace"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('expand') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('expand')}
                >
                  <DocumentAiMenuItemContent
                    icon={Plus}
                    label={AI_ACTION_LABELS.expand}
                    description="Add context and detail."
                    shortcut="Replace"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('translate') ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="items-start gap-2.5 rounded-lg px-2 py-1.5 [&>svg:last-child]:hidden">
                    <DocumentAiMenuItemContent
                      icon={Languages}
                      label={AI_ACTION_LABELS.translate}
                      description="Translate and keep markdown."
                      shortcut="Replace"
                    />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44 rounded-xl p-1.5 data-[side=right]:[translate:calc(-100%-0.625rem)_0]">
                    <DropdownMenuLabel>Translate to</DropdownMenuLabel>
                    {DOCUMENT_TRANSLATE_LANGUAGES.map((language) => (
                      <DropdownMenuItem
                        key={language.value}
                        className="rounded-lg"
                        onSelect={() =>
                          onAiDocumentAction?.('translate', {
                            targetLanguage: language.value,
                          })
                        }
                      >
                        {language.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
            </DropdownMenuGroup>
          ) : null}

          {showRewriteActions && showReviewActions ? (
            <DropdownMenuSeparator className="my-2" />
          ) : null}

          {showReviewActions ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 pb-1 pt-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Review
              </DropdownMenuLabel>
              {availableDocumentAiActionSet.has('diagram') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('diagram')}
                >
                  <DocumentAiMenuItemContent
                    icon={Columns2}
                    label={AI_ACTION_LABELS.diagram}
                    description="Build a streamed diagram preview."
                    shortcut="Preview"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('review') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('review')}
                >
                  <DocumentAiMenuItemContent
                    icon={FileSearch}
                    label={AI_ACTION_LABELS.review}
                    description="Audit clarity and coverage."
                    shortcut="Append"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('score') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('score')}
                >
                  <DocumentAiMenuItemContent
                    icon={BadgeCheck}
                    label={AI_ACTION_LABELS.score}
                    description="Generate a scorecard."
                    shortcut="Append"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('summarize') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('summarize')}
                >
                  <DocumentAiMenuItemContent
                    icon={FileText}
                    label={AI_ACTION_LABELS.summarize}
                    description="Write a short summary."
                    shortcut="Append"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('outline') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('outline')}
                >
                  <DocumentAiMenuItemContent
                    icon={ListOrdered}
                    label={AI_ACTION_LABELS.outline}
                    description="Extract an outline."
                    shortcut="Append"
                  />
                </DropdownMenuItem>
              ) : null}
              {availableDocumentAiActionSet.has('checklist') ? (
                <DropdownMenuItem
                  className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                  onSelect={() => onAiDocumentAction?.('checklist')}
                >
                  <DocumentAiMenuItemContent
                    icon={ClipboardList}
                    label={AI_ACTION_LABELS.checklist}
                    description="Turn it into a checklist."
                    shortcut="Append"
                  />
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          ) : null}
        </DropdownMenuContent>
    </DropdownMenu>
  )
}
