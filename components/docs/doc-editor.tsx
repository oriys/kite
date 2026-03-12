'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table as TiptapTable } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Node, mergeAttributes } from '@tiptap/core'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Sparkles,
} from 'lucide-react'
import {
  AI_ACTION_LABELS,
  MAX_AI_CUSTOM_PROMPT_LENGTH,
  MAX_AI_TRANSFORM_TEXT_LENGTH,
  isAiAppendResultAction,
  type AiTransformAction,
} from '@/lib/ai'
import {
  resolveAiActionModel,
  resolveAiActionPrompt,
} from '@/lib/ai-prompts'
import {
  type DocEditorAiPanelSide,
} from '@/lib/doc-editor-layout'
import { type DocSnippet } from '@/lib/doc-snippets'
import {
  createHeatmapSnippetTemplate,
  decodeHeatmapDocument,
  HEATMAP_FENCE_LANGUAGE,
  normalizeHeatmapDocument,
  renderHeatmapBlockFromData,
  serializeHeatmapDocument,
  type HeatmapDocument,
} from '@/lib/heatmap'
import { cn } from '@/lib/utils'
import { renderMarkdown } from '@/lib/markdown'
import { htmlToMd } from '@/lib/html-to-markdown'
import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPrompts } from '@/hooks/use-ai-prompts'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
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
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { DocAiResultPanel } from '@/components/docs/doc-ai-result-panel'
import { DocHeatmapEditorDialog } from '@/components/docs/doc-heatmap-editor-dialog'
import {
  DocNavigationRail,
  type DocNavigationHeading,
} from '@/components/docs/doc-navigation-rail'
import { DocToolbar, type EditorViewMode, type ToolbarMode } from '@/components/docs/doc-toolbar'
import { DocBubbleMenu } from '@/components/docs/doc-bubble-menu'
import { DocSlashMenu } from '@/components/docs/doc-slash-menu'
import { wordCount } from '@/lib/documents'

// ── Lowlight setup ─────────────────────────────────────────────────────────

const lowlight = createLowlight(common)

// ── Custom Tiptap Node Extensions ──────────────────────────────────────────

const JsonViewerNode = Node.create({
  name: 'jsonViewer',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      data: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.doc-json-viewer',
        getAttrs: (dom) => ({
          data: (dom as HTMLElement).dataset.docJson || '',
        }),
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'div',
      mergeAttributes({
        class: 'doc-json-viewer',
        'data-doc-json': node.attrs.data,
        contenteditable: 'false',
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'doc-json-viewer'
      dom.dataset.docJson = node.attrs.data
      dom.contentEditable = 'false'
      try {
        const json = decodeURIComponent(node.attrs.data)
        const parsed = JSON.parse(json)
        const html = renderMarkdown('```json\n' + JSON.stringify(parsed, null, 2) + '\n```')
        const wrapper = document.createElement('div')
        wrapper.innerHTML = html
        const viewer = wrapper.querySelector('.doc-json-viewer')
        if (viewer) {
          dom.innerHTML = viewer.innerHTML
        }
      } catch {
        dom.textContent = 'Invalid JSON'
      }
      return { dom }
    }
  },
})

const SchemaViewerNode = Node.create({
  name: 'schemaViewer',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      data: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.doc-schema-viewer',
        getAttrs: (dom) => ({
          data: (dom as HTMLElement).dataset.docSchema || '',
        }),
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'div',
      mergeAttributes({
        class: 'doc-schema-viewer',
        'data-doc-schema': node.attrs.data,
        contenteditable: 'false',
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'doc-schema-viewer'
      dom.dataset.docSchema = node.attrs.data
      dom.contentEditable = 'false'
      try {
        const md = decodeURIComponent(node.attrs.data)
        const html = renderMarkdown(md)
        dom.innerHTML = html
      } catch {
        dom.textContent = 'Invalid schema'
      }
      return { dom }
    }
  },
})

const HeatmapNode = Node.create({
  name: 'heatmapBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      data: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.doc-heatmap',
        getAttrs: (dom) => ({
          data: (dom as HTMLElement).dataset.docHeatmap || '',
        }),
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'div',
      mergeAttributes({
        class: 'doc-heatmap',
        'data-doc-heatmap': node.attrs.data,
        contenteditable: 'false',
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'doc-heatmap'
      dom.dataset.docHeatmap = node.attrs.data
      dom.contentEditable = 'false'
      const heatmapDoc = decodeHeatmapDocument(node.attrs.data)
      if (heatmapDoc) {
        dom.innerHTML = renderHeatmapBlockFromData(heatmapDoc)
      } else {
        dom.textContent = 'Invalid heatmap data'
      }
      return { dom }
    }
  },
})

// ── Types ──────────────────────────────────────────────────────────────────

type EditorMode = EditorViewMode
type SplitPaneLeading = 'wysiwyg' | 'source'
type SplitPaneScrollSource = 'rich' | 'source'

interface AiPreviewRequest {
  scope: 'selection' | 'document'
  action: AiTransformAction
  modelId: string
  modelLabel: string
  originalText: string
  selectionRange: { from: number; to: number } | null
  targetLanguage?: string
  customPrompt?: string
}

interface AiPreviewState extends AiPreviewRequest {
  resultText: string
}

interface DocEditorProps {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
  className?: string
  onModeChange?: (mode: EditorViewMode) => void
  editorFocusRef?: React.MutableRefObject<DocEditorHandle | null>
  onAiPreviewVisibilityChange?: (visible: boolean) => void
  documentWidth?: number
  onDocumentWidthChange?: (width: number) => void
  onDocumentResizeStateChange?: (active: boolean) => void
  aiPreviewSide?: DocEditorAiPanelSide
  onAiPreviewSideChange?: (side: DocEditorAiPanelSide) => void
}

export interface DocEditorHandle {
  focus: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────

const DOC_SPLIT_RATIO_STORAGE_KEY = 'doc-editor-split-pane-ratio'
const DOC_SPLIT_LEADING_STORAGE_KEY = 'doc-editor-split-pane-leading'
const DOC_SPLIT_RATIO_DEFAULT = 0.55
const DOC_SPLIT_RATIO_MIN = 0.32
const DOC_SPLIT_RATIO_MAX = 0.68
const DOC_AI_SPLIT_RATIO_STORAGE_KEY = 'doc-editor-ai-split-ratio'
const DOC_AI_SPLIT_RATIO_DEFAULT = 0.4
const DOC_AI_SPLIT_RATIO_MIN = 0.24
const DOC_AI_SPLIT_RATIO_MAX = 0.72

const DEFAULT_HEATMAP_SNIPPET: DocSnippet = {
  id: 'heatmap',
  label: 'Heatmap',
  description: 'Insert an editable heatmap block.',
  category: 'Data',
  keywords: ['heatmap', 'matrix', 'grid'],
  template: createHeatmapSnippetTemplate(),
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function readStorage<T>(key: string, parse: (v: string | null) => T, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    return parse(window.localStorage.getItem(key))
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, value)
  }
}

function readSplitPaneRatio() {
  return readStorage(DOC_SPLIT_RATIO_STORAGE_KEY, (v) => clamp(Number(v), DOC_SPLIT_RATIO_MIN, DOC_SPLIT_RATIO_MAX, DOC_SPLIT_RATIO_DEFAULT), DOC_SPLIT_RATIO_DEFAULT)
}

function readAiSplitRatio() {
  return readStorage(DOC_AI_SPLIT_RATIO_STORAGE_KEY, (v) => clamp(Number(v), DOC_AI_SPLIT_RATIO_MIN, DOC_AI_SPLIT_RATIO_MAX, DOC_AI_SPLIT_RATIO_DEFAULT), DOC_AI_SPLIT_RATIO_DEFAULT)
}

function readSplitPaneLeading(): SplitPaneLeading {
  return readStorage(DOC_SPLIT_LEADING_STORAGE_KEY, (v) => (v === 'source' ? 'source' : 'wysiwyg'), 'wysiwyg')
}

function hasRichEditor(mode: EditorMode) {
  return mode === 'wysiwyg' || mode === 'split'
}

function hasSourceEditor(mode: EditorMode) {
  return mode === 'source' || mode === 'split'
}

function mdToHtml(md: string): string {
  return renderMarkdown(md)
}

function getScrollableProgress(el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>) {
  const max = Math.max(el.scrollHeight - el.clientHeight, 0)
  return max <= 0 ? 0 : el.scrollTop / max
}

function setScrollableProgress(el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>, progress: number) {
  const max = Math.max(el.scrollHeight - el.clientHeight, 0)
  el.scrollTop = max <= 0 ? 0 : Math.min(1, Math.max(0, progress)) * max
}

function appendAiResultToDocument(currentMd: string, result: string): string {
  const trimmed = currentMd.trimEnd()
  return trimmed ? `${trimmed}\n\n---\n\n${result}` : result
}

// ── Pane transition config ─────────────────────────────────────────────────

const paneTransition = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 38,
  mass: 0.8,
}

// ── Main Editor Component ──────────────────────────────────────────────────

export function DocEditor({
  content,
  onChange,
  readOnly,
  className,
  onModeChange,
  editorFocusRef,
  onAiPreviewVisibilityChange,
  documentWidth,
  onDocumentWidthChange,
  onDocumentResizeStateChange,
  aiPreviewSide = 'right',
  onAiPreviewSideChange,
}: DocEditorProps) {
  // ── AI model state ───────────────────────────────────────────────────────
  const { items: aiModels, loading: aiModelsLoading, defaultModelId } = useAiModels()
  const { enabledModels, activeModel, activeModelId, setActiveModelId } = useAiPreferences(aiModels, defaultModelId)
  const { prompts: aiPrompts } = useAiPrompts()
  const enabledModelIds = React.useMemo(() => enabledModels.map((m) => m.id), [enabledModels])

  // ── Editor mode state ────────────────────────────────────────────────────
  const [mode, setMode] = React.useState<EditorMode>('wysiwyg')
  const [activePane, setActivePane] = React.useState<ToolbarMode>('wysiwyg')

  // ── AI state ─────────────────────────────────────────────────────────────
  const [aiPendingAction, setAiPendingAction] = React.useState<AiTransformAction | null>(null)
  const [aiPendingScope, setAiPendingScope] = React.useState<'selection' | 'document' | null>(null)
  const [aiPreview, setAiPreview] = React.useState<AiPreviewState | null>(null)
  const [customPromptOpen, setCustomPromptOpen] = React.useState(false)
  const [customPromptValue, setCustomPromptValue] = React.useState('')
  const [customPromptSelectionText, setCustomPromptSelectionText] = React.useState('')

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectionInfo, setSelectionInfo] = React.useState<{ words: number; chars: number } | null>(null)
  const [insertPickerOpen, setInsertPickerOpen] = React.useState(false)
  const [tocOpen, setTocOpen] = React.useState(false)
  const [minimapOpen, setMinimapOpen] = React.useState(false)
  const [navigationScrollProgress, setNavigationScrollProgress] = React.useState(0)
  const [navigationViewportRatio, setNavigationViewportRatio] = React.useState(0.18)
  const [showShortcuts, setShowShortcuts] = React.useState(false)
  const [heatmapEditorOpen, setHeatmapEditorOpen] = React.useState(false)
  const [heatmapDraft, _setHeatmapDraft] = React.useState<HeatmapDocument | null>(null)

  // ── Layout state ─────────────────────────────────────────────────────────
  const [documentResizeActive, setDocumentResizeActive] = React.useState(false)
  const [splitPaneResizeActive, setSplitPaneResizeActive] = React.useState(false)
  const [splitPaneRatio, setSplitPaneRatio] = React.useState(readSplitPaneRatio)
  const [aiSplitRatio, setAiSplitRatio] = React.useState(readAiSplitRatio)
  const [splitPaneLeading, setSplitPaneLeading] = React.useState<SplitPaneLeading>(readSplitPaneLeading)

  // ── Refs ─────────────────────────────────────────────────────────────────
  const editorWrapperRef = React.useRef<HTMLDivElement>(null)
  const editorViewportRef = React.useRef<HTMLDivElement>(null)
  const splitPaneRef = React.useRef<HTMLDivElement>(null)
  const aiSplitPaneRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const latestMdRef = React.useRef(content)
  const switchingRef = React.useRef(false)
  const aiRequestIdRef = React.useRef(0)
  const customPromptSelectionRef = React.useRef<{ from: number; to: number } | null>(null)
  const slashMenuRef = React.useRef<{ show: () => void; hide: () => void }>(null)
  const activeHeatmapPosRef = React.useRef<number | null>(null)
  const documentResizeRef = React.useRef<{
    startClientX: number
    startValue: number
    mode: 'document' | 'ai-preview'
    dragged: boolean
  } | null>(null)
  const splitPaneResizeRef = React.useRef<{
    startClientX: number
    startRatio: number
    dragged: boolean
  } | null>(null)
  const splitPaneScrollSyncRef = React.useRef<{
    source: SplitPaneScrollSource | null
    frame: number | null
  }>({ source: null, frame: null })

  const reducedMotion = useReducedMotion()
  const editingMode: ToolbarMode = mode === 'split' ? activePane : mode
  const aiDocumentPendingAction = aiPendingScope === 'document' ? aiPendingAction : null
  const wysiwygOnLeft = splitPaneLeading === 'wysiwyg'
  const aiPreviewOnLeft = Boolean(aiPreview) && aiPreviewSide === 'left'
  const navigationRailOpen = tocOpen || minimapOpen
  const splitPaneColumns = `minmax(0, ${splitPaneRatio}fr) minmax(0, ${1 - splitPaneRatio}fr)`
  const aiSplitColumns = aiPreview
    ? aiPreviewOnLeft
      ? `minmax(0, ${aiSplitRatio}fr) minmax(0, ${1 - aiSplitRatio}fr)`
      : `minmax(0, ${1 - aiSplitRatio}fr) minmax(0, ${aiSplitRatio}fr)`
    : null
  const aiSplitDividerPosition = aiPreviewOnLeft ? aiSplitRatio : 1 - aiSplitRatio

  // ── Tiptap Editor ────────────────────────────────────────────────────────

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        dropcursor: { color: 'oklch(0.63 0.16 244)', width: 2 },
      }),
      TiptapTable.configure({
        resizable: false,
        HTMLAttributes: { class: '' },
      }),
      TableRow,
      TableCell,
      TableHeader,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: '' },
      }),
      TiptapImage.configure({
        HTMLAttributes: { class: '' },
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: 'Start writing, or type / for commands…',
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'text',
        HTMLAttributes: {},
      }),
      JsonViewerNode,
      SchemaViewerNode,
      HeatmapNode,
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          'prose-editorial max-w-none outline-none',
          mode === 'split' ? 'min-h-full p-6 md:p-7' : 'min-h-[600px] p-6',
          readOnly && 'cursor-default opacity-70',
        ),
        role: 'textbox',
        'aria-label': 'Rich text editor',
        'aria-multiline': 'true',
      },
      handleKeyDown: (_view, event) => {
        // Slash menu trigger
        if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const { from } = editor!.state.selection
          const textBefore = editor!.state.doc.textBetween(
            Math.max(0, from - 1),
            from,
            '\n',
          )
          if (textBefore === '' || textBefore === '\n') {
            requestAnimationFrame(() => slashMenuRef.current?.show())
          }
        }

        // Toggle shortcuts dialog
        if ((event.metaKey || event.ctrlKey) && event.key === '/') {
          event.preventDefault()
          setShowShortcuts((v) => !v)
          return true
        }

        // Keyboard shortcut for inline code
        if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
          event.preventDefault()
          editor!.chain().focus().toggleCode().run()
          return true
        }

        // Link shortcut
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
          event.preventDefault()
          const linkBtn = document.querySelector('[aria-label="Link"]') as HTMLButtonElement
          linkBtn?.click()
          return true
        }

        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      const md = htmlToMd(html)
      latestMdRef.current = md
      onChange(md)
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection
      if (from !== to) {
        const text = ed.state.doc.textBetween(from, to, ' ')
        setSelectionInfo({
          words: wordCount(text),
          chars: text.length,
        })
      } else {
        setSelectionInfo(null)
      }
    },
    onFocus: () => setActivePane('wysiwyg'),
  })

  // ── Content sync ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!editor || switchingRef.current) return
    if (content !== latestMdRef.current) {
      const html = mdToHtml(content)
      editor.commands.setContent(html, { emitUpdate: false })
      latestMdRef.current = content
    }
  }, [editor, content])

  // Set readOnly when it changes
  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  // ── Focus handle ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (editorFocusRef) {
      editorFocusRef.current = {
        focus: () => editor?.commands.focus(),
      }
    }
  }, [editor, editorFocusRef])

  // ── Mode changes ─────────────────────────────────────────────────────────

  React.useEffect(() => { onModeChange?.(mode) }, [mode, onModeChange])
  React.useEffect(() => { onAiPreviewVisibilityChange?.(Boolean(aiPreview)) }, [aiPreview, onAiPreviewVisibilityChange])
  React.useEffect(() => { onDocumentResizeStateChange?.(documentResizeActive) }, [documentResizeActive, onDocumentResizeStateChange])

  const updateNavigationViewport = React.useCallback(() => {
    const richViewport = editorViewportRef.current
    const sourceViewport = textareaRef.current
    const activeViewport =
      mode === 'source'
        ? sourceViewport
        : richViewport ?? sourceViewport

    if (!activeViewport) {
      setNavigationScrollProgress(0)
      setNavigationViewportRatio(1)
      return
    }

    setNavigationScrollProgress(getScrollableProgress(activeViewport))
    setNavigationViewportRatio(
      activeViewport.scrollHeight > 0
        ? Math.min(1, activeViewport.clientHeight / activeViewport.scrollHeight)
        : 1,
    )
  }, [mode])

  React.useEffect(() => {
    updateNavigationViewport()
  }, [content, mode, updateNavigationViewport])

  React.useEffect(() => {
    const richViewport = editorViewportRef.current
    const sourceViewport = textareaRef.current

    const handleViewportChange = () => {
      updateNavigationViewport()
    }

    richViewport?.addEventListener('scroll', handleViewportChange, { passive: true })
    sourceViewport?.addEventListener('scroll', handleViewportChange, { passive: true })
    window.addEventListener('resize', handleViewportChange)

    return () => {
      richViewport?.removeEventListener('scroll', handleViewportChange)
      sourceViewport?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [mode, updateNavigationViewport])

  const handleModeChange = React.useCallback((newMode: EditorViewMode) => {
    switchingRef.current = true
    setMode(newMode)

    if (newMode === 'wysiwyg' || newMode === 'split') {
      if (editor) {
        const html = mdToHtml(latestMdRef.current)
        editor.commands.setContent(html, { emitUpdate: false })
      }
    }

    if (newMode === 'source' || newMode === 'split') {
      setActivePane('source')
    } else {
      setActivePane('wysiwyg')
    }

    requestAnimationFrame(() => {
      switchingRef.current = false
    })
  }, [editor])

  // ── Source editor sync ───────────────────────────────────────────────────

  const handleSourceChange = React.useCallback((newContent: string) => {
    latestMdRef.current = newContent
    onChange(newContent)

    if (hasRichEditor(mode) && editor) {
      const html = mdToHtml(newContent)
      editor.commands.setContent(html, { emitUpdate: false })
    }
  }, [editor, mode, onChange])

  // ── AI integration ───────────────────────────────────────────────────────

  const resolveActionModelSelection = React.useCallback(
    (action: AiTransformAction) => {
      const modelId = resolveAiActionModel(action, aiPrompts, activeModelId, enabledModelIds)
      if (!modelId) return null
      const model = enabledModels.find((m) => m.id === modelId) ?? (activeModel?.id === modelId ? activeModel : null)
      return model ? { modelId: model.id, modelLabel: model.label } : { modelId, modelLabel: modelId }
    },
    [enabledModels, enabledModelIds, activeModelId, activeModel, aiPrompts],
  )

  const runAiPreviewRequest = React.useCallback(
    async (request: AiPreviewRequest) => {
      const requestId = ++aiRequestIdRef.current
      setAiPendingAction(request.action)
      setAiPendingScope(request.scope)
      setAiPreview({ ...request, resultText: '' })

      try {
        const actionPrompt = resolveAiActionPrompt(
          request.action,
          aiPrompts,
          request.targetLanguage,
        )

        const response = await fetch('/api/ai/transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: request.action,
            text: request.originalText.slice(0, MAX_AI_TRANSFORM_TEXT_LENGTH),
            model: request.modelId,
            targetLanguage: request.targetLanguage,
            systemPrompt: aiPrompts.systemPrompt,
            actionPrompt,
            customPrompt: request.customPrompt,
          }),
        })

        if (requestId !== aiRequestIdRef.current) return

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error ?? `Transform failed (${response.status})`)
        }

        const data = (await response.json()) as { result: string }

        if (requestId !== aiRequestIdRef.current) return

        setAiPreview((prev) =>
          prev ? { ...prev, resultText: data.result } : null,
        )
      } catch (error) {
        if (requestId !== aiRequestIdRef.current) return
        toast.error('AI transform failed', {
          description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        })
        setAiPreview(null)
      } finally {
        if (requestId === aiRequestIdRef.current) {
          setAiPendingAction(null)
          setAiPendingScope(null)
        }
      }
    },
    [aiPrompts],
  )

  const handleAiAction = React.useCallback(
    (action: AiTransformAction, options?: { targetLanguage?: string }) => {
      if (!editor || readOnly) return
      const { from, to } = editor.state.selection
      if (from === to) return
      const text = editor.state.doc.textBetween(from, to, ' ')
      if (!text.trim()) return

      const modelSelection = resolveActionModelSelection(action)
      if (!modelSelection) {
        toast.error('No AI model available', {
          description: 'Enable at least one model in the AI manager.',
        })
        return
      }

      void runAiPreviewRequest({
        scope: 'selection',
        action,
        modelId: modelSelection.modelId,
        modelLabel: modelSelection.modelLabel,
        originalText: text,
        selectionRange: { from, to },
        targetLanguage: options?.targetLanguage,
      })
    },
    [editor, readOnly, resolveActionModelSelection, runAiPreviewRequest],
  )

  const handleAiDocumentAction = React.useCallback(
    (action: AiTransformAction, options?: { targetLanguage?: string }) => {
      if (readOnly) return
      const text = latestMdRef.current
      if (!text.trim()) {
        toast.error('Document is empty', {
          description: 'Write some content before using AI actions.',
        })
        return
      }

      const modelSelection = resolveActionModelSelection(action)
      if (!modelSelection) {
        toast.error('No AI model available', {
          description: 'Enable at least one model in the AI manager.',
        })
        return
      }

      void runAiPreviewRequest({
        scope: 'document',
        action,
        modelId: modelSelection.modelId,
        modelLabel: modelSelection.modelLabel,
        originalText: text,
        selectionRange: null,
        targetLanguage: options?.targetLanguage,
      })
    },
    [readOnly, resolveActionModelSelection, runAiPreviewRequest],
  )

  const handleAiPreviewOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      aiRequestIdRef.current += 1
      setAiPreview(null)
      setAiPendingAction(null)
      setAiPendingScope(null)
    }
  }, [])

  const handleRetryAiPreview = React.useCallback(() => {
    if (!aiPreview) return
    const { resultText: _, ...request } = aiPreview
    void runAiPreviewRequest(request)
  }, [aiPreview, runAiPreviewRequest])

  const handleAcceptAiPreview = React.useCallback(() => {
    if (!aiPreview || !aiPreview.resultText) return

    handleAiPreviewOpenChange(false)

    requestAnimationFrame(() => {
      if (!editor) return

      if (aiPreview.scope === 'document') {
        const nextContent = isAiAppendResultAction(aiPreview.action)
          ? appendAiResultToDocument(latestMdRef.current, aiPreview.resultText)
          : aiPreview.resultText

        const html = mdToHtml(nextContent)
        editor.commands.setContent(html, { emitUpdate: false })
        latestMdRef.current = nextContent
        onChange(nextContent)
        setSelectionInfo(null)
        return
      }

      const sel = aiPreview.selectionRange
      if (!sel) return

      if (isAiAppendResultAction(aiPreview.action)) {
        const insertPos = Math.min(sel.to, editor.state.doc.content.size)
        const resultHtml = mdToHtml('\n\n' + aiPreview.resultText)
        editor.chain().focus().insertContentAt(insertPos, resultHtml).run()
      } else {
        editor
          .chain()
          .focus()
          .deleteRange({ from: sel.from, to: sel.to })
          .insertContentAt(sel.from, aiPreview.resultText)
          .run()
      }

      const html = editor.getHTML()
      const md = htmlToMd(html)
      latestMdRef.current = md
      onChange(md)
      setSelectionInfo(null)
    })
  }, [aiPreview, editor, handleAiPreviewOpenChange, onChange])

  const handleOpenAiCustomPrompt = React.useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const text = editor.state.doc.textBetween(from, to, ' ')
    customPromptSelectionRef.current = { from, to }
    setCustomPromptSelectionText(text)
    setCustomPromptOpen(true)
  }, [editor])

  const handleSubmitCustomPrompt = React.useCallback(async () => {
    const sel = customPromptSelectionRef.current
    if (!sel || !customPromptValue.trim()) return

    const text = editor?.state.doc.textBetween(sel.from, sel.to, ' ') ?? customPromptSelectionText

    const modelSelection = resolveActionModelSelection('custom')
    if (!modelSelection) {
      toast.error('No AI model available')
      return
    }

    setCustomPromptOpen(false)

    void runAiPreviewRequest({
      scope: 'selection',
      action: 'custom',
      modelId: modelSelection.modelId,
      modelLabel: modelSelection.modelLabel,
      originalText: text,
      selectionRange: sel,
      customPrompt: customPromptValue,
    })

    setCustomPromptValue('')
    setCustomPromptSelectionText('')
    customPromptSelectionRef.current = null
  }, [customPromptValue, customPromptSelectionText, editor, resolveActionModelSelection, runAiPreviewRequest])

  // ── Bubble menu handler ──────────────────────────────────────────────────

  const handleBubbleAction = React.useCallback(
    (action: string) => {
      if (!editor) return
      switch (action) {
        case 'bold':
          editor.chain().focus().toggleBold().run()
          break
        case 'italic':
          editor.chain().focus().toggleItalic().run()
          break
        case 'strikethrough':
          editor.chain().focus().toggleStrike().run()
          break
        case 'code':
          editor.chain().focus().toggleCode().run()
          break
      }
    },
    [editor],
  )

  // ── Slash menu handler ───────────────────────────────────────────────────

  const handleSlashMenuClose = React.useCallback(() => {
    slashMenuRef.current?.hide()
    editor?.commands.focus()
  }, [editor])

  const handleSlashSelect = React.useCallback(
    (action: string) => {
      if (!editor) return

      // Remove the "/" character that triggered the menu
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from)
      if (textBefore === '/') {
        editor.chain().focus().deleteRange({ from: from - 1, to: from }).run()
      }

      switch (action) {
        case 'text':
          editor.chain().focus().setParagraph().run()
          break
        case 'h1':
          editor.chain().focus().toggleHeading({ level: 1 }).run()
          break
        case 'h2':
          editor.chain().focus().toggleHeading({ level: 2 }).run()
          break
        case 'h3':
          editor.chain().focus().toggleHeading({ level: 3 }).run()
          break
        case 'ul':
          editor.chain().focus().toggleBulletList().run()
          break
        case 'ol':
          editor.chain().focus().toggleOrderedList().run()
          break
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run()
          break
        case 'divider':
          editor.chain().focus().setHorizontalRule().run()
          break
        case 'table':
          editor.chain().focus().insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run()
          break
        case 'code':
          editor.chain().focus().toggleCodeBlock().run()
          break
        case 'heatmap': {
          const html = mdToHtml(DEFAULT_HEATMAP_SNIPPET.template)
          editor.chain().focus().insertContent(html + '<p></p>').run()
          break
        }
      }

      const newHtml = editor.getHTML()
      const md = htmlToMd(newHtml)
      latestMdRef.current = md
      onChange(md)
    },
    [editor, onChange],
  )

  // ── Snippet insertion ────────────────────────────────────────────────────

  const handleInsertSnippet = React.useCallback(
    (snippet: DocSnippet) => {
      if (!editor) return
      const html = mdToHtml(snippet.template)
      editor.chain().focus().insertContent(html).run()
      const newHtml = editor.getHTML()
      const md = htmlToMd(newHtml)
      latestMdRef.current = md
      onChange(md)
    },
    [editor, onChange],
  )

  const handleInsertCodeBlock = React.useCallback(
    (language: string) => {
      if (!editor) return
      editor.chain().focus().toggleCodeBlock().run()
      // Set language on the code block node
      editor.commands.updateAttributes('codeBlock', { language })
    },
    [editor],
  )

  // ── Heatmap editor ───────────────────────────────────────────────────────

  const handleHeatmapSave = React.useCallback(
    (data: HeatmapDocument) => {
      if (!editor) return
      const normalized = normalizeHeatmapDocument(data)
      const serialized = serializeHeatmapDocument(normalized)
      const html = mdToHtml('```' + HEATMAP_FENCE_LANGUAGE + '\n' + serialized + '\n```')
      if (activeHeatmapPosRef.current !== null) {
        // Replace the heatmap node at the stored position
        const pos = activeHeatmapPosRef.current
        editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).insertContentAt(pos, html).run()
      } else {
        editor.chain().focus().insertContent(html).run()
      }
      setHeatmapEditorOpen(false)
      const newHtml = editor.getHTML()
      const md = htmlToMd(newHtml)
      latestMdRef.current = md
      onChange(md)
    },
    [editor, onChange],
  )

  // ── Split pane scroll sync ───────────────────────────────────────────────

  const handleSplitPaneScroll = React.useCallback(
    (source: SplitPaneScrollSource, scrollElement: HTMLElement, targetElement: HTMLElement) => {
      const sync = splitPaneScrollSyncRef.current
      if (sync.source && sync.source !== source) return
      sync.source = source

      if (sync.frame !== null) cancelAnimationFrame(sync.frame)
      sync.frame = requestAnimationFrame(() => {
        const progress = getScrollableProgress(scrollElement)
        setScrollableProgress(targetElement, progress)
        sync.source = null
        sync.frame = null
      })
    },
    [],
  )

  const scrollDocumentToProgress = React.useCallback(
    (progress: number) => {
      const normalized = Math.min(1, Math.max(0, progress))
      const richViewport = hasRichEditor(mode) ? editorViewportRef.current : null
      const sourceViewport = hasSourceEditor(mode) ? textareaRef.current : null

      if (richViewport) {
        const maxScroll = Math.max(richViewport.scrollHeight - richViewport.clientHeight, 0)
        richViewport.scrollTo({
          top: maxScroll * normalized,
          behavior: 'smooth',
        })
      }

      if (sourceViewport) {
        const maxScroll = Math.max(sourceViewport.scrollHeight - sourceViewport.clientHeight, 0)
        sourceViewport.scrollTo({
          top: maxScroll * normalized,
          behavior: 'smooth',
        })
      }

      setNavigationScrollProgress(normalized)
    },
    [mode],
  )

  const handleJumpToHeading = React.useCallback(
    (heading: DocNavigationHeading) => {
      const richViewport = hasRichEditor(mode) ? editorViewportRef.current : null
      const proseMirror = editorWrapperRef.current?.querySelector('.ProseMirror')
      const headingElements = proseMirror
        ? (Array.from(
            proseMirror.querySelectorAll('h1, h2, h3, h4, h5, h6'),
          ) as HTMLElement[])
        : []
      const targetHeading = richViewport ? headingElements[heading.index] ?? null : null

      if (richViewport && targetHeading) {
        const maxScroll = Math.max(richViewport.scrollHeight - richViewport.clientHeight, 0)
        const top = Math.max(0, Math.min(targetHeading.offsetTop - 20, maxScroll))
        const progress = maxScroll > 0 ? top / maxScroll : 0

        richViewport.scrollTo({
          top,
          behavior: 'smooth',
        })

        if (hasSourceEditor(mode) && textareaRef.current) {
          const sourceMaxScroll = Math.max(
            textareaRef.current.scrollHeight - textareaRef.current.clientHeight,
            0,
          )
          textareaRef.current.scrollTo({
            top: sourceMaxScroll * progress,
            behavior: 'smooth',
          })
        }

        setNavigationScrollProgress(progress)
        return
      }

      scrollDocumentToProgress(heading.progress)
    },
    [mode, scrollDocumentToProgress],
  )

  // ── Split pane resize ────────────────────────────────────────────────────

  const handleSplitPaneResizeStart = React.useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    splitPaneResizeRef.current = {
      startClientX: event.clientX,
      startRatio: splitPaneRatio,
      dragged: false,
    }
    setSplitPaneResizeActive(true)
  }, [splitPaneRatio])

  React.useEffect(() => {
    if (!splitPaneResizeActive) return
    const onMove = (e: MouseEvent) => {
      const ref = splitPaneResizeRef.current
      const pane = splitPaneRef.current
      if (!ref || !pane) return
      ref.dragged = true
      const dx = e.clientX - ref.startClientX
      const paneWidth = pane.offsetWidth
      if (paneWidth <= 0) return
      const next = clamp(ref.startRatio + dx / paneWidth, DOC_SPLIT_RATIO_MIN, DOC_SPLIT_RATIO_MAX, DOC_SPLIT_RATIO_DEFAULT)
      setSplitPaneRatio(next)
    }
    const onUp = () => {
      setSplitPaneResizeActive(false)
      const ref = splitPaneResizeRef.current
      if (!ref?.dragged) {
        const next: SplitPaneLeading = splitPaneLeading === 'wysiwyg' ? 'source' : 'wysiwyg'
        setSplitPaneLeading(next)
        writeStorage(DOC_SPLIT_LEADING_STORAGE_KEY, next)
      } else {
        writeStorage(DOC_SPLIT_RATIO_STORAGE_KEY, String(splitPaneRatio))
      }
      splitPaneResizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [splitPaneResizeActive, splitPaneLeading, splitPaneRatio])

  // ── Document / AI pane resize ────────────────────────────────────────────

  const handleDocumentResizeStart = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const resizingAi = Boolean(aiPreview)
      const canResizeAi = resizingAi && Boolean(aiSplitPaneRef.current)
      const canResizeDoc = !resizingAi && typeof documentWidth === 'number' && Boolean(onDocumentWidthChange)
      if (!canResizeAi && !canResizeDoc) return

      event.preventDefault()
      event.stopPropagation()

      documentResizeRef.current = {
        startClientX: event.clientX,
        startValue: canResizeAi ? aiSplitRatio : documentWidth ?? 0,
        mode: canResizeAi ? 'ai-preview' : 'document',
        dragged: false,
      }
      setDocumentResizeActive(true)
    },
    [aiPreview, aiSplitRatio, documentWidth, onDocumentWidthChange],
  )

  React.useEffect(() => {
    if (!documentResizeActive) return
    const onMove = (e: MouseEvent) => {
      const ref = documentResizeRef.current
      if (!ref) return
      ref.dragged = true
      if (ref.mode === 'ai-preview') {
        const pane = aiSplitPaneRef.current
        if (!pane) return
        const dx = e.clientX - ref.startClientX
        const paneWidth = pane.offsetWidth
        if (paneWidth <= 0) return
        const next = clamp(ref.startValue + dx / paneWidth, DOC_AI_SPLIT_RATIO_MIN, DOC_AI_SPLIT_RATIO_MAX, DOC_AI_SPLIT_RATIO_DEFAULT)
        setAiSplitRatio(next)
      } else {
        const dx = e.clientX - ref.startClientX
        const next = Math.max(520, ref.startValue + dx * 2)
        onDocumentWidthChange?.(next)
      }
    }
    const onUp = () => {
      setDocumentResizeActive(false)
      const ref = documentResizeRef.current
      if (ref?.mode === 'ai-preview') {
        if (!ref.dragged && onAiPreviewSideChange) {
          onAiPreviewSideChange(aiPreviewSide === 'left' ? 'right' : 'left')
        } else {
          writeStorage(DOC_AI_SPLIT_RATIO_STORAGE_KEY, String(aiSplitRatio))
        }
      }
      documentResizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [documentResizeActive, aiSplitRatio, aiPreviewSide, onAiPreviewSideChange, onDocumentWidthChange])

  // ── Source keyboard shortcuts ────────────────────────────────────────────

  const handleSourceKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = textareaRef.current
      if (!ta) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        sourceWrap(ta, '**', '**')
        handleSourceChange(ta.value)
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        sourceWrap(ta, '_', '_')
        handleSourceChange(ta.value)
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        sourceWrap(ta, '`', '`')
        handleSourceChange(ta.value)
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        sourceWrap(ta, '[', '](url)')
        handleSourceChange(ta.value)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        document.execCommand('insertText', false, '  ')
        handleSourceChange(ta.value)
      } else if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setShowShortcuts((v) => !v)
      }
    },
    [handleSourceChange],
  )

  // ── Capture selection for source mode ────────────────────────────────────

  const captureSourceSelection = React.useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart, selectionEnd } = ta
    if (selectionStart !== selectionEnd) {
      const text = ta.value.substring(selectionStart, selectionEnd)
      setSelectionInfo({ words: wordCount(text), chars: text.length })
    } else {
      setSelectionInfo(null)
    }
  }, [])

  // ── Capture current selection for insert operations ──────────────────────

  const captureCurrentSelection = React.useCallback(() => {
    // No-op for Tiptap — selection is managed by ProseMirror
  }, [])

  // ── Custom AI model selection ────────────────────────────────────────────

  const customActionModelSelection = resolveActionModelSelection('custom')

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-md border border-border/75 bg-card/95', className)}>
      {/* Toolbar */}
      <DocToolbar
        mode={editingMode}
        editorMode={mode}
        textareaRef={textareaRef}
        editorRef={editorWrapperRef}
        tiptapEditor={editor}
        disabled={readOnly}
        onEditorModeChange={handleModeChange}
        onSourceChange={handleSourceChange}
        onRichChange={() => {
          if (!editor) return
          const html = editor.getHTML()
          const md = htmlToMd(html)
          latestMdRef.current = md
          onChange(md)
        }}
        insertPickerOpen={insertPickerOpen}
        onInsertPickerOpenChange={setInsertPickerOpen}
        onBeforeOpenInsertPicker={captureCurrentSelection}
        onInsertSnippet={handleInsertSnippet}
        onBeforeOpenCodeMenu={captureCurrentSelection}
        onInsertCodeBlock={handleInsertCodeBlock}
        tocOpen={tocOpen}
        onTocOpenChange={setTocOpen}
        minimapOpen={minimapOpen}
        onMinimapOpenChange={setMinimapOpen}
        activeAiLabel={activeModel?.label ?? activeModelId}
        aiDisabled={Boolean(aiPendingAction) || !activeModelId}
        aiDocumentPendingAction={aiDocumentPendingAction}
        onAiDocumentAction={(action, options) => {
          void handleAiDocumentAction(action, options)
        }}
      />

      {/* Editor area */}
      <div
        ref={aiSplitPaneRef}
        style={
          aiPreview && aiSplitColumns
            ? ({ '--doc-ai-split-columns': aiSplitColumns } as React.CSSProperties)
            : undefined
        }
        className={cn(
          'group/ai-split-pane relative flex-1 min-h-0 grid grid-cols-1 motion-reduce:transition-none xl:transition-[grid-template-columns] xl:duration-300 xl:ease-[cubic-bezier(0.22,1,0.36,1)]',
          aiPreview
            ? 'xl:[grid-template-columns:var(--doc-ai-split-columns)]'
            : 'xl:[grid-template-columns:minmax(0,1fr)]',
        )}
      >
        <motion.div
          layout
          transition={paneTransition}
          style={
            mode === 'split'
              ? ({ '--doc-split-columns': splitPaneColumns } as React.CSSProperties)
              : undefined
          }
          className={cn(
            'group/document-pane relative min-h-0 min-w-0',
            aiPreviewOnLeft ? 'xl:order-2' : 'xl:order-1',
          )}
        >
          <div
            className={cn(
              'flex h-full min-h-0 min-w-0 flex-col',
              navigationRailOpen && 'md:flex-row',
            )}
          >
            <div
              ref={splitPaneRef}
              className={cn(
                'group/split-pane relative min-h-0 min-w-0 flex-1',
                mode === 'split'
                  ? 'grid h-full grid-cols-1 md:[grid-template-columns:var(--doc-split-columns)]'
                  : 'flex h-full flex-col',
              )}
            >
              {/* WYSIWYG Pane */}
              <AnimatePresence initial={false} mode="popLayout">
                {hasRichEditor(mode) ? (
                  <motion.div
                    key="rich-pane"
                    ref={editorViewportRef}
                    layout
                    initial={reducedMotion ? false : { opacity: 0, x: -18, scale: 0.995 }}
                    animate={reducedMotion ? undefined : { opacity: 1, x: 0, scale: 1 }}
                    exit={reducedMotion ? undefined : { opacity: 0, x: -18, scale: 0.995 }}
                    transition={paneTransition}
                    className={cn(
                      'min-h-0 overflow-auto transition-[box-shadow] duration-200',
                      mode === 'split' && (wysiwygOnLeft ? 'md:order-1' : 'md:order-2'),
                      mode !== 'split' && 'flex-1',
                      mode === 'split' && 'border-b border-border/60 md:border-b-0',
                      mode === 'split' &&
                        activePane === 'wysiwyg' &&
                        (wysiwygOnLeft
                          ? 'shadow-[inset_0_-2px_0_0_var(--accent)] md:shadow-[inset_-2px_0_0_0_var(--accent)]'
                          : 'shadow-[inset_0_-2px_0_0_var(--accent)] md:shadow-[inset_2px_0_0_0_var(--accent)]'),
                    )}
                    onScroll={
                      mode === 'split' && textareaRef.current
                        ? () => {
                            const viewport = editorViewportRef.current
                            const ta = textareaRef.current
                            if (viewport && ta) {
                              handleSplitPaneScroll('rich', viewport, ta)
                            }
                          }
                        : undefined
                    }
                  >
                    <div ref={editorWrapperRef} className="relative min-h-full">
                      <EditorContent editor={editor} />

                      {!readOnly && hasRichEditor(mode) && editor && (
                        <>
                          <DocBubbleMenu
                            editorRef={editorWrapperRef}
                            onAction={handleBubbleAction}
                            onLinkAction={() => {
                              const linkBtn = document.querySelector('[aria-label="Link"]') as HTMLButtonElement
                              linkBtn?.click()
                            }}
                            onAiAction={handleAiAction}
                            onOpenAiCustomPrompt={handleOpenAiCustomPrompt}
                            aiPendingAction={aiPendingAction}
                            enabledModels={enabledModels}
                            activeModelId={activeModel?.id ?? activeModelId}
                            onActiveModelChange={setActiveModelId}
                            aiModelsLoading={aiModelsLoading}
                          />
                          <DocSlashMenu
                            ref={slashMenuRef}
                            editorRef={editorWrapperRef}
                            onSelect={handleSlashSelect}
                            onClose={handleSlashMenuClose}
                          />

                          {selectionInfo && (
                            <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                              <span>
                                {selectionInfo.words} {selectionInfo.words === 1 ? 'word' : 'words'}
                              </span>
                              <span className="opacity-40">/</span>
                              <span>
                                {selectionInfo.chars} {selectionInfo.chars === 1 ? 'char' : 'chars'}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Source Pane */}
              <AnimatePresence initial={false} mode="popLayout">
                {hasSourceEditor(mode) ? (
                  <motion.div
                    key="source-pane"
                    layout
                    initial={reducedMotion ? false : { opacity: 0, x: 18, scale: 0.995 }}
                    animate={reducedMotion ? undefined : { opacity: 1, x: 0, scale: 1 }}
                    exit={reducedMotion ? undefined : { opacity: 0, x: 18, scale: 0.995 }}
                    transition={paneTransition}
                    className={cn(
                      'min-h-0 transition-[box-shadow] duration-200',
                      mode === 'split' && (wysiwygOnLeft ? 'md:order-2' : 'md:order-1'),
                      mode !== 'split' && 'flex-1',
                      mode === 'split' && 'bg-muted/[0.14]',
                      mode === 'split' &&
                        activePane === 'source' &&
                        (wysiwygOnLeft
                          ? 'shadow-[inset_0_-2px_0_0_var(--accent)] md:shadow-[inset_2px_0_0_0_var(--accent)]'
                          : 'shadow-[inset_0_-2px_0_0_var(--accent)] md:shadow-[inset_-2px_0_0_0_var(--accent)]'),
                    )}
                  >
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => handleSourceChange(e.target.value)}
                      onKeyDown={handleSourceKeyDown}
                      onFocus={() => setActivePane('source')}
                      onSelect={captureSourceSelection}
                      onClick={captureSourceSelection}
                      onKeyUp={captureSourceSelection}
                      readOnly={readOnly}
                      spellCheck={false}
                      aria-label="Markdown source editor"
                      className={cn(
                        'block w-full resize-none bg-transparent',
                        'font-mono text-[13px] leading-7 text-foreground',
                        'placeholder:text-muted-foreground/60',
                        'outline-none',
                        mode === 'split' ? 'h-full min-h-[600px] p-5 md:p-6' : 'h-full min-h-[600px] p-4',
                        readOnly && 'cursor-default opacity-70',
                      )}
                      placeholder="Start writing in Markdown…"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Split pane resize handle */}
              {mode === 'split' ? (
                <button
                  type="button"
                  onMouseDown={handleSplitPaneResizeStart}
                  aria-label="Drag to resize split editors, click to swap sides"
                  title="Drag to resize split editors, click to swap sides"
                  className="absolute inset-y-0 z-40 hidden w-4 -translate-x-1/2 cursor-col-resize items-center justify-center md:flex"
                  style={{ left: `${splitPaneRatio * 100}%` }}
                >
                  <span
                    className={cn(
                      'absolute h-full w-px bg-border/60 transition-colors duration-200',
                      splitPaneResizeActive ? 'bg-foreground/45' : 'group-hover/split-pane:bg-foreground/28',
                    )}
                  />
                </button>
              ) : null}
            </div>

            {navigationRailOpen ? (
              <DocNavigationRail
                content={content}
                tocOpen={tocOpen}
                minimapOpen={minimapOpen}
                scrollProgress={navigationScrollProgress}
                viewportRatio={navigationViewportRatio}
                onJumpToHeading={handleJumpToHeading}
                onJumpToProgress={scrollDocumentToProgress}
              />
            ) : null}
          </div>

          {/* Document width resize handle */}
          {!aiPreview && onDocumentWidthChange && typeof documentWidth === 'number' ? (
            <button
              type="button"
              onMouseDown={handleDocumentResizeStart}
              aria-label="Resize document width"
              className={cn(
                'absolute inset-y-0 z-40 hidden cursor-col-resize items-center justify-center xl:flex',
                'w-4 right-0 translate-x-1/2',
              )}
            >
              <span
                className={cn(
                  'h-full w-px bg-border/60 transition-colors duration-200',
                  documentResizeActive ? 'bg-foreground/45' : 'group-hover/document-pane:bg-foreground/28',
                )}
              />
            </button>
          ) : null}
        </motion.div>

        {/* AI Preview Pane */}
        <div
          className={cn(
            'h-full min-h-0 min-w-0 overflow-hidden motion-reduce:transition-none',
            aiPreviewOnLeft ? 'xl:order-1' : 'xl:order-2',
            aiPreview ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          aria-hidden={!aiPreview}
        >
          {aiPreview ? (
            <div
              className={cn(
                'flex h-full min-h-0 flex-col animate-in fade-in duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none',
                aiPreviewOnLeft ? 'slide-in-from-left-3' : 'slide-in-from-right-3',
              )}
            >
              <DocAiResultPanel
                scope={aiPreview.scope}
                action={aiPreview.action}
                resultText={aiPreview.resultText}
                modelLabel={aiPreview.modelLabel}
                modelId={aiPreview.modelId}
                targetLanguage={aiPreview.targetLanguage}
                customPrompt={aiPreview.customPrompt}
                pending={aiPendingAction === aiPreview.action}
                onRetry={handleRetryAiPreview}
                onAccept={handleAcceptAiPreview}
                side={aiPreviewSide}
                onClose={() => handleAiPreviewOpenChange(false)}
              />
            </div>
          ) : null}
        </div>

        {/* AI split resize handle */}
        {aiPreview ? (
          <button
            type="button"
            onMouseDown={handleDocumentResizeStart}
            aria-label="Drag to resize AI split panes, click to swap sides"
            title="Drag to resize AI split panes, click to swap sides"
            className="absolute inset-y-0 z-40 hidden w-4 -translate-x-1/2 cursor-col-resize items-center justify-center xl:flex"
            style={{ left: `${aiSplitDividerPosition * 100}%` }}
          >
            <span
              className={cn(
                'absolute h-full w-px bg-border/60 transition-colors duration-200',
                documentResizeActive ? 'bg-foreground/45' : 'group-hover/ai-split-pane:bg-foreground/28',
              )}
            />
          </button>
        ) : null}

        {/* Custom AI Prompt Dialog */}
        <Dialog
          open={customPromptOpen}
          onOpenChange={(open) => {
            setCustomPromptOpen(open)
            if (!open) {
              customPromptSelectionRef.current = null
              setCustomPromptSelectionText('')
              setCustomPromptValue('')
            }
          }}
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
                {customActionModelSelection?.modelLabel ?? 'No AI enabled'}
              </Badge>
              <Badge variant="outline">{customPromptSelectionText.length} selected characters</Badge>
            </div>

            <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Selected text
              </p>
              <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
                {customPromptSelectionText}
              </p>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="custom-ai-prompt">Prompt</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="custom-ai-prompt"
                    value={customPromptValue}
                    onChange={(event) => setCustomPromptValue(event.target.value)}
                    className="min-h-36 leading-6"
                    placeholder="Example: Rewrite this into a concise changelog for release notes, keep all technical terms and bullet structure."
                    maxLength={MAX_AI_CUSTOM_PROMPT_LENGTH}
                    autoFocus
                  />
                  <FieldDescription>
                    Be explicit about tone, format, constraints, or what should stay unchanged.
                    {` ${customPromptValue.length} / ${MAX_AI_CUSTOM_PROMPT_LENGTH}`}
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCustomPromptOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSubmitCustomPrompt()} disabled={!customPromptValue.trim()}>
                <Sparkles data-icon="inline-start" />
                Run prompt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />

        <DocHeatmapEditorDialog
          open={heatmapEditorOpen}
          data={heatmapDraft}
          onOpenChange={(open) => {
            setHeatmapEditorOpen(open)
          }}
          onSave={handleHeatmapSave}
        />
      </div>
    </div>
  )
}

// ── Source mode helpers ─────────────────────────────────────────────────────

function sourceWrap(ta: HTMLTextAreaElement, before: string, after: string) {
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
