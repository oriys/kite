'use client'

import * as React from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
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
  Table,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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

interface DocToolbarProps {
  mode: ToolbarMode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editorRef?: React.RefObject<HTMLDivElement | null>
  disabled?: boolean
}

export function DocToolbar({ mode, textareaRef, editorRef, disabled }: DocToolbarProps) {
  const handleClick = (item: ToolbarAction) => {
    if (mode === 'source') {
      if (textareaRef?.current) item.sourceAction(textareaRef.current)
    } else {
      editorRef?.current?.focus()
      item.richAction()
    }
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/30 px-2 py-1.5">
        {actions.map((item, i) => {
          if (item === 'separator') {
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
