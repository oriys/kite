'use client'

import * as React from 'react'
import {
  Bold,
  ChevronDown,
  Columns2,
  Italic,
  Strikethrough,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Image,
  Minus,
  PenLine,
  Table,
} from 'lucide-react'
import { type DocSnippet } from '@/lib/doc-snippets'
import { CODE_LANGUAGE_OPTIONS, type CodeLanguageOption } from '@/lib/code-highlighting'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { DocSnippetPicker } from '@/components/docs/doc-snippet-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
    icon: Link2,
    label: 'Link',
    shortcut: '⌘K',
    sourceAction: (ta) => wrapSelection(ta, '[', '](url)'),
    richAction: () => {
      const url = prompt('URL:')
      if (url) richExec('createLink', url)
    },
  },
  {
    icon: Image,
    label: 'Image',
    sourceAction: (ta) => insertBlock(ta, '![alt](url)\n'),
    richAction: () => {
      const url = prompt('Image URL:')
      if (url) richInsertBlock(`<img src="${url}" alt="image" />`)
    },
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

interface DocToolbarProps {
  mode: ToolbarMode
  editorMode: EditorViewMode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editorRef?: React.RefObject<HTMLDivElement | null>
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
}

export function DocToolbar({
  mode,
  editorMode,
  textareaRef,
  editorRef,
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
}: DocToolbarProps) {
  const handleClick = (item: ToolbarAction) => {
    if (mode === 'source') {
      if (textareaRef?.current) {
        item.sourceAction(textareaRef.current)
        onSourceChange?.(textareaRef.current.value)
      }
    } else {
      editorRef?.current?.focus()
      item.richAction()
      requestAnimationFrame(() => {
        onRichChange?.()
      })
    }
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/30 px-2 py-1.5">
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
    </TooltipProvider>
  )
}
