import { type AiTransformAction } from '@/lib/ai'
import { type DocEditorAiPanelSide } from '@/lib/doc-editor-layout'
import { type DocSnippet } from '@/lib/doc-snippets'
import { createHeatmapSnippetTemplate } from '@/lib/heatmap'
import { renderMarkdown } from '@/lib/markdown'
import { type EditorViewMode } from '@/components/docs/doc-toolbar'

// ── Types ──────────────────────────────────────────────────────────────────

export type EditorMode = EditorViewMode
export type SplitPaneLeading = 'wysiwyg' | 'source'
export type SplitPaneScrollSource = 'rich' | 'source'

export interface AiPreviewRequest {
  scope: 'selection' | 'document'
  action: AiTransformAction
  modelId: string
  modelLabel: string
  originalText: string
  selectionRange: { from: number; to: number } | null
  targetLanguage?: string
  customPrompt?: string
}

export interface AiPreviewState extends AiPreviewRequest {
  resultText: string
}

export interface CommentSelection {
  from: number
  to: number
  text: string
}

export interface DocEditorProps {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
  readOnlyAiActions?: readonly AiTransformAction[]
  commentsEnabled?: boolean
  statsOverlayContainerRef?: React.RefObject<HTMLDivElement | null>
  className?: string
  onModeChange?: (mode: EditorViewMode) => void
  editorFocusRef?: React.MutableRefObject<DocEditorHandle | null>
  onAiPreviewVisibilityChange?: (visible: boolean) => void
  documentWidth?: number
  onDocumentWidthChange?: (width: number) => void
  onDocumentResizeStateChange?: (active: boolean) => void
  fullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  aiPreviewSide?: DocEditorAiPanelSide
  onAiPreviewSideChange?: (side: DocEditorAiPanelSide) => void
  onComment?: (selection: CommentSelection) => void
}

export interface DocEditorHandle {
  focus: () => void
  flushPendingContent?: () => string
  applyCommentMark?: (from: number, to: number, commentId: string) => void
}

// ── Constants ──────────────────────────────────────────────────────────────

export const DOC_SPLIT_RATIO_STORAGE_KEY = 'doc-editor-split-pane-ratio'
export const DOC_SPLIT_LEADING_STORAGE_KEY = 'doc-editor-split-pane-leading'
export const DOC_SPLIT_RATIO_DEFAULT = 0.55
export const DOC_SPLIT_RATIO_MIN = 0.32
export const DOC_SPLIT_RATIO_MAX = 0.68
export const DOC_AI_SPLIT_RATIO_STORAGE_KEY = 'doc-editor-ai-split-ratio'
export const DOC_AI_SPLIT_RATIO_DEFAULT = 0.4
export const DOC_AI_SPLIT_RATIO_MIN = 0.24
export const DOC_AI_SPLIT_RATIO_MAX = 0.72

export const DEFAULT_HEATMAP_SNIPPET: DocSnippet = {
  id: 'heatmap',
  label: 'Heatmap',
  description: 'Insert an editable heatmap block.',
  category: 'Data',
  keywords: ['heatmap', 'matrix', 'grid'],
  template: createHeatmapSnippetTemplate(),
}

export const PANE_TRANSITION = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 38,
  mass: 0.8,
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function readStorage<T>(key: string, parse: (v: string | null) => T, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    return parse(window.localStorage.getItem(key))
  } catch {
    return fallback
  }
}

export function writeStorage(key: string, value: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, value)
  }
}

export function readSplitPaneRatio() {
  return readStorage(DOC_SPLIT_RATIO_STORAGE_KEY, (v) => clamp(Number(v), DOC_SPLIT_RATIO_MIN, DOC_SPLIT_RATIO_MAX, DOC_SPLIT_RATIO_DEFAULT), DOC_SPLIT_RATIO_DEFAULT)
}

export function readAiSplitRatio() {
  return readStorage(DOC_AI_SPLIT_RATIO_STORAGE_KEY, (v) => clamp(Number(v), DOC_AI_SPLIT_RATIO_MIN, DOC_AI_SPLIT_RATIO_MAX, DOC_AI_SPLIT_RATIO_DEFAULT), DOC_AI_SPLIT_RATIO_DEFAULT)
}

export function readSplitPaneLeading(): SplitPaneLeading {
  return readStorage(DOC_SPLIT_LEADING_STORAGE_KEY, (v) => (v === 'source' ? 'source' : 'wysiwyg'), 'wysiwyg')
}

export function hasRichEditor(mode: EditorMode) {
  return mode === 'wysiwyg' || mode === 'split'
}

export function hasSourceEditor(mode: EditorMode) {
  return mode === 'source' || mode === 'split'
}

export function mdToHtml(md: string): string {
  return renderMarkdown(md)
}

export function hasRenderableMarkdown(value: string): boolean {
  const text = value.trim()
  if (!text) return false

  return (
    /(^|\n)\|.+\|\s*\n\|(?:\s*:?-{3,}:?\s*\|)+/m.test(text) ||
    /^#{1,6}\s.+/m.test(text) ||
    /^\s*(?:[-*+]\s|\d+\.\s).+/m.test(text) ||
    /^\s*>\s.+/m.test(text) ||
    /^\s{0,3}(?:[-*_]\s*){3,}$/m.test(text) ||
    /```[\s\S]*?```/.test(text) ||
    /`[^`\n]+`/.test(text) ||
    /(?:\*\*|__)[^\n]+(?:\*\*|__)/.test(text) ||
    /(?<!\*)\*[^*\n]+\*(?!\*)/.test(text) ||
    /(?<!_)_[^_\n]+_(?!_)/.test(text) ||
    /!?\[[^\]]+\]\([^)]+\)/.test(text)
  )
}

export function getScrollableProgress(el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>) {
  const max = Math.max(el.scrollHeight - el.clientHeight, 0)
  return max <= 0 ? 0 : el.scrollTop / max
}

export function setScrollableProgress(el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>, progress: number) {
  const max = Math.max(el.scrollHeight - el.clientHeight, 0)
  el.scrollTop = max <= 0 ? 0 : Math.min(1, Math.max(0, progress)) * max
}

export function appendAiResultToDocument(currentMd: string, result: string): string {
  const trimmed = currentMd.trimEnd()
  return trimmed ? `${trimmed}\n\n---\n\n${result}` : result
}

export function sourceWrap(ta: HTMLTextAreaElement, before: string, after: string) {
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
