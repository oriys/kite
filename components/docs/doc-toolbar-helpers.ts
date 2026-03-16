import type { ComponentType } from 'react'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Image as ImageIcon,
  Table,
} from 'lucide-react'
import { type AiTransformAction } from '@/lib/ai'

// ── Shared types ────────────────────────────────────────────────────────────

export type ToolbarMode = 'source' | 'wysiwyg'
export type EditorViewMode = ToolbarMode | 'split'

// ── Source-mode helpers (textarea) ──────────────────────────────────────────

export function wrapSelection(ta: HTMLTextAreaElement, before: string, after: string) {
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

export function insertAtLineStart(ta: HTMLTextAreaElement, prefix: string) {
  const start = ta.selectionStart
  const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
  ta.setSelectionRange(lineStart, lineStart)
  ta.focus()
  document.execCommand('insertText', false, prefix)
  ta.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length)
}

export function insertBlock(ta: HTMLTextAreaElement, block: string) {
  const start = ta.selectionStart
  const needsNewline = start > 0 && ta.value[start - 1] !== '\n'
  const text = needsNewline ? `\n${block}` : block
  ta.focus()
  document.execCommand('insertText', false, text)
}

// ── WYSIWYG-mode helpers (contentEditable) ─────────────────────────────────

export function richExec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

export function richWrap(tag: string) {
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

export function richInsertBlock(html: string) {
  richExec('insertHTML', html)
}

// ── Action definitions ─────────────────────────────────────────────────────

export interface ToolbarAction {
  id?: string
  icon: ComponentType<{ className?: string }>
  label: string
  shortcut?: string
  sourceAction: (textarea: HTMLTextAreaElement) => void
  richAction: () => void
}

export const actions: (ToolbarAction | 'separator')[] = [
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

// ── AI-related constants ───────────────────────────────────────────────────

export const AI_PENDING_LABELS: Record<AiTransformAction, string> = {
  polish: 'Polishing',
  tone: 'Changing tone',
  autofix: 'Fixing',
  format: 'Fixing Markdown',
  shorten: 'Shortening',
  expand: 'Expanding',
  continueWriting: 'Continuing draft',
  translate: 'Translating',
  explain: 'Explaining',
  diagram: 'Drawing diagram',
  review: 'Reviewing',
  score: 'Scoring',
  summarize: 'Summarizing',
  outline: 'Outlining',
  checklist: 'Building checklist',
  custom: 'Running prompt',
}

export const DOCUMENT_TRANSLATE_LANGUAGES = [
  { label: 'Chinese', value: 'Simplified Chinese' },
  { label: 'English', value: 'English' },
  { label: 'Japanese', value: 'Japanese' },
  { label: 'Korean', value: 'Korean' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' },
] as const

export const DEFAULT_DOCUMENT_AI_ACTIONS = [
  'polish',
  'tone',
  'autofix',
  'format',
  'shorten',
  'expand',
  'continueWriting',
  'translate',
  'diagram',
  'review',
  'score',
  'summarize',
  'outline',
  'checklist',
] as const satisfies readonly AiTransformAction[]

export const DOCUMENT_REWRITE_ACTIONS = [
  'polish',
  'tone',
  'autofix',
  'format',
  'shorten',
  'expand',
  'continueWriting',
  'translate',
] as const satisfies readonly AiTransformAction[]

export const DOCUMENT_REVIEW_ACTIONS = [
  'diagram',
  'review',
  'score',
  'summarize',
  'outline',
  'checklist',
] as const satisfies readonly AiTransformAction[]
