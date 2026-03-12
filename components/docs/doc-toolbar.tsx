'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import {
  BadgeCheck,
  Bold,
  ClipboardList,
  ChevronDown,
  Columns2,
  Italic,
  Loader2,
  Sparkles,
  Strikethrough,
  FileCode,
  FileSearch,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Languages,
  List,
  ListOrdered,
  Plus,
  Quote,
  Code,
  Link2,
  Image as ImageIcon,
  Minus,
  PenLine,
  Table,
} from 'lucide-react'
import { AI_ACTION_LABELS, type AiTransformAction } from '@/lib/ai'
import { type DocSnippet } from '@/lib/doc-snippets'
import { CODE_LANGUAGE_OPTIONS, type CodeLanguageOption } from '@/lib/code-highlighting'
import { cn } from '@/lib/utils'
import { DocAiGlyph } from '@/components/docs/doc-ai-glyph'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { DocSnippetPicker } from '@/components/docs/doc-snippet-picker'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ── Source-mode helpers (textarea) ──────────────────────────────────────────

function wrapSelection(ta: HTMLTextAreaElement, before: string, after: string) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.substring(start, end)
  const replacement = `${before}${selected || 'text'}${after}`
  ta.focus()
  document.execCommand('insertText', false, replacement)
  const newStart = start + before.length
  const newEnd = newStart + (selected.length || 4)
  ta.setSelectionRange(newStart, newEnd)
}

function insertAtLineStart(ta: HTMLTextAreaElement, prefix: string) {
  const start = ta.selectionStart
  const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
  ta.setSelectionRange(lineStart, lineStart)
  ta.focus()
  document.execCommand('insertText', false, prefix)
  ta.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length)
}

function insertBlock(ta: HTMLTextAreaElement, block: string) {
  const start = ta.selectionStart
  const needsNewline = start > 0 && ta.value[start - 1] !== '\n'
  const text = needsNewline ? `\n${block}` : block
  ta.focus()
  document.execCommand('insertText', false, text)
}

// ── WYSIWYG-mode helpers (contentEditable) ─────────────────────────────────

function richExec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

function richWrap(tag: string) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const el = document.createElement(tag)
  range.surroundContents(el)
  sel.removeAllRanges()
  const newRange = document.createRange()
  newRange.selectNodeContents(el)
  sel.addRange(newRange)
}

function richInsertBlock(html: string) {
  richExec('insertHTML', html)
}

// ── Action definitions ─────────────────────────────────────────────────────

interface ToolbarAction {
  id?: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortcut?: string
  sourceAction: (textarea: HTMLTextAreaElement) => void
  richAction: () => void
}

const actions: (ToolbarAction | 'separator')[] = [
  {
    icon: Bold,
    label: 'Bold',
    shortcut: '⌘B',
    sourceAction: (ta) => wrapSelection(ta, '**', '**'),
    richAction: () => richExec('bold'),
  },
  {
    icon: Italic,
    label: 'Italic',
    shortcut: '⌘I',
    sourceAction: (ta) => wrapSelection(ta, '_', '_'),
    richAction: () => richExec('italic'),
  },
  {
    icon: Strikethrough,
    label: 'Strikethrough',
    shortcut: '⌘⇧X',
    sourceAction: (ta) => wrapSelection(ta, '~~', '~~'),
    richAction: () => richExec('strikeThrough'),
  },
  {
    icon: Code,
    label: 'Inline Code',
    shortcut: '⌘E',
    sourceAction: (ta) => wrapSelection(ta, '`', '`'),
    richAction: () => richWrap('code'),
  },
  'separator',
  {
    icon: Heading1,
    label: 'Heading 1',
    sourceAction: (ta) => insertAtLineStart(ta, '# '),
    richAction: () => richExec('formatBlock', 'h1'),
  },
  {
    icon: Heading2,
    label: 'Heading 2',
    sourceAction: (ta) => insertAtLineStart(ta, '## '),
    richAction: () => richExec('formatBlock', 'h2'),
  },
  {
    icon: Heading3,
    label: 'Heading 3',
    sourceAction: (ta) => insertAtLineStart(ta, '### '),
    richAction: () => richExec('formatBlock', 'h3'),
  },
  'separator',
  {
    icon: List,
    label: 'Bullet List',
    sourceAction: (ta) => insertAtLineStart(ta, '- '),
    richAction: () => richExec('insertUnorderedList'),
  },
  {
    icon: ListOrdered,
    label: 'Numbered List',
    sourceAction: (ta) => insertAtLineStart(ta, '1. '),
    richAction: () => richExec('insertOrderedList'),
  },
  {
    icon: Quote,
    label: 'Blockquote',
    sourceAction: (ta) => insertAtLineStart(ta, '> '),
    richAction: () => richExec('formatBlock', 'blockquote'),
  },
  'separator',
  {
    id: 'link',
    icon: Link2,
    label: 'Link',
    shortcut: '⌘K',
    sourceAction: (ta) => wrapSelection(ta, '[', '](url)'),
    richAction: () => {},
  },
  {
    id: 'image',
    icon: ImageIcon,
    label: 'Image',
    sourceAction: (ta) => insertBlock(ta, '![alt](url)\n'),
    richAction: () => {},
  },
  {
    icon: Table,
    label: 'Table',
    sourceAction: (ta) => insertBlock(ta, '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n'),
    richAction: () =>
      richInsertBlock(
        '<table><thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr></thead><tbody><tr><td>Cell</td><td>Cell</td><td>Cell</td></tr></tbody></table>',
      ),
  },
  {
    icon: Minus,
    label: 'Horizontal Rule',
    sourceAction: (ta) => insertBlock(ta, '\n---\n'),
    richAction: () => richExec('insertHorizontalRule'),
  },
]

// ── Inline insert popovers ──────────────────────────────────────────────

interface LinkPopoverProps {
  disabled?: boolean
  mode: ToolbarMode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editorRef?: React.RefObject<HTMLDivElement | null>
  tiptapEditor?: Editor | null
  onSourceChange?: (content: string) => void
  onRichChange?: () => void
}

function LinkPopover({ disabled, mode, textareaRef, editorRef, tiptapEditor, onSourceChange, onRichChange }: LinkPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = url.trim()
    if (!trimmed) return

    if (mode === 'source' && textareaRef?.current) {
      wrapSelection(textareaRef.current, '[', `](${trimmed})`)
      onSourceChange?.(textareaRef.current.value)
    } else if (tiptapEditor) {
      tiptapEditor.chain().focus().setLink({ href: trimmed }).run()
      requestAnimationFrame(() => onRichChange?.())
    } else {
      editorRef?.current?.focus()
      richExec('createLink', trimmed)
      requestAnimationFrame(() => onRichChange?.())
    }
    setUrl('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next)
      if (!next) setUrl('')
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Link"
            >
              <Link2 className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Link
          <span className="ml-2 text-muted-foreground">⌘K</span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-72 p-3" onOpenAutoFocus={(e) => {
        e.preventDefault()
        inputRef.current?.focus()
      }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground">URL</label>
          <Input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 text-sm"
          />
          <Button type="submit" size="sm" className="h-7 self-end text-xs" disabled={!url.trim()}>
            Insert Link
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

interface ImagePopoverProps {
  disabled?: boolean
  mode: ToolbarMode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editorRef?: React.RefObject<HTMLDivElement | null>
  tiptapEditor?: Editor | null
  onSourceChange?: (content: string) => void
  onRichChange?: () => void
}

function ImagePopover({ disabled, mode, textareaRef, editorRef, tiptapEditor, onSourceChange, onRichChange }: ImagePopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState('')
  const [alt, setAlt] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    const altText = alt.trim() || 'image'

    if (mode === 'source' && textareaRef?.current) {
      insertBlock(textareaRef.current, `![${altText}](${trimmed})\n`)
      onSourceChange?.(textareaRef.current.value)
    } else if (tiptapEditor) {
      tiptapEditor.chain().focus().setImage({ src: trimmed, alt: altText }).run()
      requestAnimationFrame(() => onRichChange?.())
    } else {
      editorRef?.current?.focus()
      richInsertBlock(`<img src="${trimmed}" alt="${altText}" />`)
      requestAnimationFrame(() => onRichChange?.())
    }
    setUrl('')
    setAlt('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next)
      if (!next) { setUrl(''); setAlt('') }
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Image"
            >
              <ImageIcon aria-hidden="true" className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Image
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-72 p-3" onOpenAutoFocus={(e) => {
        e.preventDefault()
        inputRef.current?.focus()
      }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground">Image URL</label>
          <Input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 text-sm"
          />
          <label className="text-xs font-medium text-foreground">Alt text</label>
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe the image…"
            className="h-8 text-sm"
          />
          <Button type="submit" size="sm" className="h-7 self-end text-xs" disabled={!url.trim()}>
            Insert Image
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

// ── Toolbar component ──────────────────────────────────────────────────────

export type ToolbarMode = 'source' | 'wysiwyg'
export type EditorViewMode = ToolbarMode | 'split'

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

interface EditorModeMenuProps {
  value: EditorViewMode
  onChange: (mode: EditorViewMode) => void
}

function EditorModeMenu({ value, onChange }: EditorModeMenuProps) {
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

interface CodeBlockMenuProps {
  disabled?: boolean
  onBeforeOpen?: () => void
  onSelect: (language: CodeLanguageOption) => void
}

function CodeBlockMenu({ disabled, onBeforeOpen, onSelect }: CodeBlockMenuProps) {
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

const DOCUMENT_TRANSLATE_LANGUAGES = [
  { label: 'Chinese', value: 'Simplified Chinese' },
  { label: 'English', value: 'English' },
  { label: 'Japanese', value: 'Japanese' },
  { label: 'Korean', value: 'Korean' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' },
] as const

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

interface DocToolbarProps {
  mode: ToolbarMode
  editorMode: EditorViewMode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editorRef?: React.RefObject<HTMLDivElement | null>
  tiptapEditor?: Editor | null
  disabled?: boolean
  onEditorModeChange: (mode: EditorViewMode) => void
  onSourceChange?: (content: string) => void
  onRichChange?: () => void
  insertPickerOpen: boolean
  onInsertPickerOpenChange: (open: boolean) => void
  onBeforeOpenInsertPicker?: () => void
  onInsertSnippet?: (snippet: DocSnippet) => void
  onBeforeOpenCodeMenu?: () => void
  onInsertCodeBlock?: (language: string) => void
  activeAiLabel?: string | null
  aiDisabled?: boolean
  aiDocumentPendingAction?: AiTransformAction | null
  onAiDocumentAction?: (
    action: AiTransformAction,
    options?: { targetLanguage?: string },
  ) => void
}

const AI_PENDING_LABELS: Record<AiTransformAction, string> = {
  polish: 'Polishing',
  shorten: 'Shortening',
  expand: 'Expanding',
  translate: 'Translating',
  explain: 'Explaining',
  review: 'Reviewing',
  score: 'Scoring',
  summarize: 'Summarizing',
  outline: 'Outlining',
  checklist: 'Building checklist',
  custom: 'Running prompt',
}

export function DocToolbar({
  mode,
  editorMode,
  textareaRef,
  editorRef,
  tiptapEditor,
  disabled,
  onEditorModeChange,
  onSourceChange,
  onRichChange,
  insertPickerOpen,
  onInsertPickerOpenChange,
  onBeforeOpenInsertPicker,
  onInsertSnippet,
  onBeforeOpenCodeMenu,
  onInsertCodeBlock,
  activeAiLabel,
  aiDisabled,
  aiDocumentPendingAction,
  onAiDocumentAction,
}: DocToolbarProps) {
  const handleClick = (item: ToolbarAction) => {
    if (mode === 'source') {
      if (textareaRef?.current) {
        item.sourceAction(textareaRef.current)
        onSourceChange?.(textareaRef.current.value)
      }
    } else if (tiptapEditor) {
      const chain = tiptapEditor.chain().focus()
      switch (item.label) {
        case 'Bold': chain.toggleBold().run(); break
        case 'Italic': chain.toggleItalic().run(); break
        case 'Strikethrough': chain.toggleStrike().run(); break
        case 'Inline Code': chain.toggleCode().run(); break
        case 'Heading 1': chain.toggleHeading({ level: 1 }).run(); break
        case 'Heading 2': chain.toggleHeading({ level: 2 }).run(); break
        case 'Heading 3': chain.toggleHeading({ level: 3 }).run(); break
        case 'Bullet List': chain.toggleBulletList().run(); break
        case 'Numbered List': chain.toggleOrderedList().run(); break
        case 'Blockquote': chain.toggleBlockquote().run(); break
        case 'Table': chain.insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run(); break
        case 'Horizontal Rule': chain.setHorizontalRule().run(); break
        default: item.richAction(); break
      }
      requestAnimationFrame(() => { onRichChange?.() })
    } else {
      editorRef?.current?.focus()
      item.richAction()
      requestAnimationFrame(() => {
        onRichChange?.()
      })
    }
  }

  const canUseDocumentAi =
    !disabled && !aiDisabled && Boolean(onAiDocumentAction)
  const isDocumentAiWorking = Boolean(aiDocumentPendingAction)
  const documentAiButtonLabel = aiDocumentPendingAction
    ? `${AI_PENDING_LABELS[aiDocumentPendingAction]}…`
    : 'AI Actions'

  return (
    <TooltipProvider delayDuration={400}>
      <div
        role="toolbar"
        aria-label="Editor formatting toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-1.5"
      >
        <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-0.5 pr-1">
            <EditorModeMenu value={editorMode} onChange={onEditorModeChange} />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <DocSnippetPicker
              open={insertPickerOpen}
              disabled={disabled || !onInsertSnippet}
              onBeforeOpen={onBeforeOpenInsertPicker}
              onOpenChange={onInsertPickerOpenChange}
              onSelect={(snippet) => onInsertSnippet?.(snippet)}
            />
            <Separator orientation="vertical" className="mx-1 h-5" />
            {actions.map((item, i) => {
              if (item === 'separator') {
                if (i === 4 && onInsertCodeBlock) {
                  return (
                    <React.Fragment key={`sep-${i}`}>
                      <CodeBlockMenu
                        disabled={disabled}
                        onBeforeOpen={onBeforeOpenCodeMenu}
                        onSelect={(language) => onInsertCodeBlock(language.value)}
                      />
                      <Separator orientation="vertical" className="mx-1 h-5" />
                    </React.Fragment>
                  )
                }
                return <Separator key={i} orientation="vertical" className="mx-1 h-5" />
              }
              if (item.id === 'link') {
                return (
                  <LinkPopover
                    key={item.label}
                    disabled={disabled}
                    mode={mode}
                    textareaRef={textareaRef}
                    editorRef={editorRef}
                    tiptapEditor={tiptapEditor}
                    onSourceChange={onSourceChange}
                    onRichChange={onRichChange}
                  />
                )
              }
              if (item.id === 'image') {
                return (
                  <ImagePopover
                    key={item.label}
                    disabled={disabled}
                    mode={mode}
                    textareaRef={textareaRef}
                    editorRef={editorRef}
                    tiptapEditor={tiptapEditor}
                    onSourceChange={onSourceChange}
                    onRichChange={onRichChange}
                  />
                )
              }
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      onMouseDown={(e) => {
                        // Prevent focus steal from editor
                        e.preventDefault()
                        handleClick(item)
                      }}
                      aria-label={item.label}
                    >
                      <item.icon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {item.label}
                    {item.shortcut && (
                      <span className="ml-2 text-muted-foreground">{item.shortcut}</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-l border-border/50 pl-2">
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

              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Rewrite
                </DropdownMenuLabel>
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
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="my-2" />

              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 pb-1 pt-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Review
                </DropdownMenuLabel>
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
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  )
}
