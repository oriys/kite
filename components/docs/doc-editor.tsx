'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table as TiptapTable } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TiptapLink from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import CharacterCount from '@tiptap/extension-character-count'
import { common, createLowlight } from 'lowlight'
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
  HEATMAP_FENCE_LANGUAGE,
  normalizeHeatmapDocument,
  serializeHeatmapDocument,
  type HeatmapDocument,
} from '@/lib/heatmap'
import { cn } from '@/lib/utils'
import { htmlToMd } from '@/lib/html-to-markdown'
import { type DocSnippet } from '@/lib/doc-snippets'
import { JsonViewerNode, SchemaViewerNode, HeatmapNode } from '@/lib/editor/custom-nodes'
import { CommentMark } from '@/lib/editor/comment-marks'
import { createImagePasteDropExtension } from '@/lib/editor/image-paste-drop'
import { SearchReplace } from '@/lib/editor/search-replace'
import { DocFindReplace } from '@/components/docs/doc-find-replace'
import {
  type AiPreviewRequest,
  type AiPreviewState,
  type DocEditorProps,
  type EditorMode,
  DEFAULT_HEATMAP_SNIPPET,
  PANE_TRANSITION,
  hasRichEditor,
  hasSourceEditor,
  mdToHtml,
  appendAiResultToDocument,
  sourceWrap,
} from '@/lib/editor/editor-helpers'
import { useEditorResize } from '@/hooks/use-editor-resize'
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
import { DocToolbar, type EditorViewMode, type ToolbarMode } from '@/components/docs/doc-toolbar'
import { DocBubbleMenu } from '@/components/docs/doc-bubble-menu'
import { DocSlashMenu } from '@/components/docs/doc-slash-menu'
import { wordCount } from '@/lib/utils'

export type { DocEditorHandle } from '@/lib/editor/editor-helpers'

// ── Lowlight setup ─────────────────────────────────────────────────────────

const lowlight = createLowlight(common)

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

  // ── AI state (consolidated reducer to minimize re-renders) ───────────────
  type AiState = {
    pendingAction: AiTransformAction | null
    pendingScope: 'selection' | 'document' | null
    preview: AiPreviewState | null
    customPromptOpen: boolean
    customPromptValue: string
    customPromptSelectionText: string
  }
  type AiAction =
    | { type: 'SET_PENDING'; action: AiTransformAction | null; scope: 'selection' | 'document' | null }
    | { type: 'SET_PREVIEW'; preview: AiPreviewState | null }
    | { type: 'SET_PREVIEW_RESULT'; resultText: string }
    | { type: 'OPEN_CUSTOM_PROMPT'; selectionText: string }
    | { type: 'CLOSE_CUSTOM_PROMPT' }
    | { type: 'SET_CUSTOM_PROMPT_VALUE'; value: string }
    | { type: 'RESET' }
  const [ai, dispatchAi] = React.useReducer(
    (state: AiState, action: AiAction): AiState => {
      switch (action.type) {
        case 'SET_PENDING':
          return { ...state, pendingAction: action.action, pendingScope: action.scope }
        case 'SET_PREVIEW':
          return { ...state, preview: action.preview }
        case 'SET_PREVIEW_RESULT':
          return state.preview ? { ...state, preview: { ...state.preview, resultText: action.resultText } } : state
        case 'OPEN_CUSTOM_PROMPT':
          return { ...state, customPromptOpen: true, customPromptValue: '', customPromptSelectionText: action.selectionText }
        case 'CLOSE_CUSTOM_PROMPT':
          return { ...state, customPromptOpen: false }
        case 'SET_CUSTOM_PROMPT_VALUE':
          return { ...state, customPromptValue: action.value }
        case 'RESET':
          return { pendingAction: null, pendingScope: null, preview: null, customPromptOpen: false, customPromptValue: '', customPromptSelectionText: '' }
        default:
          return state
      }
    },
    { pendingAction: null, pendingScope: null, preview: null, customPromptOpen: false, customPromptValue: '', customPromptSelectionText: '' },
  )

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectionInfo, setSelectionInfo] = React.useState<{ words: number; chars: number } | null>(null)
  const [insertPickerOpen, setInsertPickerOpen] = React.useState(false)
  const [showShortcuts, setShowShortcuts] = React.useState(false)
  const [heatmapEditorOpen, setHeatmapEditorOpen] = React.useState(false)
  const [linkInputOpen, setLinkInputOpen] = React.useState(false)
  const [linkInputUrl, setLinkInputUrl] = React.useState('')
  const [findReplaceOpen, setFindReplaceOpen] = React.useState(false)
  const [a11yAnnouncement, setA11yAnnouncement] = React.useState('')

  const announce = React.useCallback((message: string) => {
    setA11yAnnouncement('')
    requestAnimationFrame(() => setA11yAnnouncement(message))
  }, [])

  // ── Layout (resize hook) ─────────────────────────────────────────────────
  const resize = useEditorResize({
    documentWidth,
    onDocumentWidthChange,
    aiPreviewSide,
    onAiPreviewSideChange,
    hasAiPreview: Boolean(ai.preview),
  })

  // ── Refs ─────────────────────────────────────────────────────────────────
  const editorWrapperRef = React.useRef<HTMLDivElement>(null)
  const editorViewportRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const latestMdRef = React.useRef(content)
  const switchingRef = React.useRef(false)
  const htmlToMdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestIdRef = React.useRef(0)
  const customPromptSelectionRef = React.useRef<{ from: number; to: number } | null>(null)
  const slashMenuRef = React.useRef<{ show: () => void; hide: () => void }>(null)
  const activeHeatmapPosRef = React.useRef<number | null>(null)

  const reducedMotion = useReducedMotion()
  const editingMode: ToolbarMode = mode === 'split' ? activePane : mode
  const aiDocumentPendingAction = ai.pendingScope === 'document' ? ai.pendingAction : null
  const wysiwygOnLeft = resize.splitPaneLeading === 'wysiwyg'
  const aiPreviewOnLeft = Boolean(ai.preview) && aiPreviewSide === 'left'
  const splitPaneColumns = `minmax(0, ${resize.splitPaneRatio}fr) minmax(0, ${1 - resize.splitPaneRatio}fr)`
  const aiSplitColumns = ai.preview
    ? aiPreviewOnLeft
      ? `minmax(0, ${resize.aiSplitRatio}fr) minmax(0, ${1 - resize.aiSplitRatio}fr)`
      : `minmax(0, ${1 - resize.aiSplitRatio}fr) minmax(0, ${resize.aiSplitRatio}fr)`
    : null
  const aiSplitDividerPosition = aiPreviewOnLeft ? resize.aiSplitRatio : 1 - resize.aiSplitRatio

  // ── Tiptap Editor ────────────────────────────────────────────────────────

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        dropcursor: { color: 'oklch(0.63 0.16 244)', width: 2 },
      }),
      TiptapTable.configure({
        resizable: true,
        HTMLAttributes: { class: '' },
      }),
      TableRow,
      TableCell,
      TableHeader,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: '' },
      }),
      createImagePasteDropExtension().configure({
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
      CharacterCount,
      SearchReplace,
      CommentMark,
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
        'aria-label': readOnly ? 'Rich text editor (read-only)' : 'Rich text editor',
        'aria-multiline': 'true',
        ...(readOnly ? { 'aria-readonly': 'true' } : {}),
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

        // Link shortcut — toggle link via editor command
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
          event.preventDefault()
          openLinkInput()
          return true
        }

        // Strikethrough shortcut
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'x') {
          event.preventDefault()
          editor!.chain().focus().toggleStrike().run()
          return true
        }

        // Find/Replace shortcut
        if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
          event.preventDefault()
          setFindReplaceOpen(true)
          return true
        }

        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Debounce the expensive HTML→MD conversion (150ms)
      if (htmlToMdTimerRef.current) clearTimeout(htmlToMdTimerRef.current)
      htmlToMdTimerRef.current = setTimeout(() => {
        const html = ed.getHTML()
        const md = htmlToMd(html)
        latestMdRef.current = md
        onChange(md)
      }, 150)
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

  // ── Link input helpers ──────────────────────────────────────────────────

  // Flush any pending debounced HTML→MD conversion
  const flushHtmlToMd = React.useCallback(() => {
    if (htmlToMdTimerRef.current && editor) {
      clearTimeout(htmlToMdTimerRef.current)
      htmlToMdTimerRef.current = null
      const html = editor.getHTML()
      const md = htmlToMd(html)
      latestMdRef.current = md
      onChange(md)
    }
  }, [editor, onChange])

  // Clean up debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (htmlToMdTimerRef.current) clearTimeout(htmlToMdTimerRef.current)
    }
  }, [])

  const openLinkInput = React.useCallback(() => {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const currentUrl = editor.getAttributes('link').href ?? ''
    setLinkInputUrl(typeof currentUrl === 'string' ? currentUrl : '')
    setLinkInputOpen(true)
  }, [editor])

  const submitLinkInput = React.useCallback(() => {
    const url = linkInputUrl.trim()
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run()
    }
    setLinkInputOpen(false)
    setLinkInputUrl('')
  }, [editor, linkInputUrl])

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
  React.useEffect(() => { onAiPreviewVisibilityChange?.(Boolean(ai.preview)) }, [ai.preview, onAiPreviewVisibilityChange])
  React.useEffect(() => { onDocumentResizeStateChange?.(resize.documentResizeActive) }, [resize.documentResizeActive, onDocumentResizeStateChange])

  const handleModeChange = React.useCallback((newMode: EditorViewMode) => {
    flushHtmlToMd()
    switchingRef.current = true
    setMode(newMode)

    const modeLabels: Record<EditorViewMode, string> = {
      wysiwyg: 'Rich text editing',
      source: 'Markdown source editing',
      split: 'Split view',
    }
    announce(`Switched to ${modeLabels[newMode]} mode`)

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
  }, [editor, announce, flushHtmlToMd])

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
      dispatchAi({ type: 'SET_PENDING', action: request.action, scope: request.scope })
      dispatchAi({ type: 'SET_PREVIEW', preview: { ...request, resultText: '' } })

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

        dispatchAi({ type: 'SET_PREVIEW_RESULT', resultText: data.result })
        announce('AI result ready for review')
      } catch (error) {
        if (requestId !== aiRequestIdRef.current) return
        toast.error('AI transform failed', {
          description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        })
        dispatchAi({ type: 'SET_PREVIEW', preview: null })
        announce('AI transform failed')
      } finally {
        if (requestId === aiRequestIdRef.current) {
          dispatchAi({ type: 'SET_PENDING', action: null, scope: null })
        }
      }
    },
    [aiPrompts, announce],
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
      dispatchAi({ type: 'SET_PREVIEW', preview: null })
      dispatchAi({ type: 'SET_PENDING', action: null, scope: null })
    }
  }, [])

  const handleRetryAiPreview = React.useCallback(() => {
    if (!ai.preview) return
    const request: AiPreviewRequest = {
      scope: ai.preview.scope,
      action: ai.preview.action,
      modelId: ai.preview.modelId,
      modelLabel: ai.preview.modelLabel,
      originalText: ai.preview.originalText,
      selectionRange: ai.preview.selectionRange,
      targetLanguage: ai.preview.targetLanguage,
      customPrompt: ai.preview.customPrompt,
    }
    void runAiPreviewRequest(request)
  }, [ai.preview, runAiPreviewRequest])

  const handleAcceptAiPreview = React.useCallback(() => {
    if (!ai.preview || !ai.preview.resultText) return

    handleAiPreviewOpenChange(false)

    requestAnimationFrame(() => {
      if (!editor) return

      if (ai.preview!.scope === 'document') {
        const nextContent = isAiAppendResultAction(ai.preview!.action)
          ? appendAiResultToDocument(latestMdRef.current, ai.preview!.resultText)
          : ai.preview!.resultText

        const html = mdToHtml(nextContent)
        editor.commands.setContent(html, { emitUpdate: false })
        latestMdRef.current = nextContent
        onChange(nextContent)
        setSelectionInfo(null)
        return
      }

      const sel = ai.preview!.selectionRange
      if (!sel) return

      if (isAiAppendResultAction(ai.preview!.action)) {
        const insertPos = Math.min(sel.to, editor.state.doc.content.size)
        const resultHtml = mdToHtml('\n\n' + ai.preview!.resultText)
        editor.chain().focus().insertContentAt(insertPos, resultHtml).run()
      } else {
        editor
          .chain()
          .focus()
          .deleteRange({ from: sel.from, to: sel.to })
          .insertContentAt(sel.from, ai.preview!.resultText)
          .run()
      }

      const html = editor.getHTML()
      const md = htmlToMd(html)
      latestMdRef.current = md
      onChange(md)
      setSelectionInfo(null)
    })
  }, [ai.preview, editor, handleAiPreviewOpenChange, onChange])

  const handleOpenAiCustomPrompt = React.useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const text = editor.state.doc.textBetween(from, to, ' ')
    customPromptSelectionRef.current = { from, to }
    dispatchAi({ type: 'OPEN_CUSTOM_PROMPT', selectionText: text })
  }, [editor])

  const handleSubmitCustomPrompt = React.useCallback(async () => {
    const sel = customPromptSelectionRef.current
    if (!sel || !ai.customPromptValue.trim()) return

    const text = editor?.state.doc.textBetween(sel.from, sel.to, ' ') ?? ai.customPromptSelectionText

    const modelSelection = resolveActionModelSelection('custom')
    if (!modelSelection) {
      toast.error('No AI model available')
      return
    }

    dispatchAi({ type: 'CLOSE_CUSTOM_PROMPT' })

    void runAiPreviewRequest({
      scope: 'selection',
      action: 'custom',
      modelId: modelSelection.modelId,
      modelLabel: modelSelection.modelLabel,
      originalText: text,
      selectionRange: sel,
      customPrompt: ai.customPromptValue,
    })

    customPromptSelectionRef.current = null
  }, [ai.customPromptValue, ai.customPromptSelectionText, editor, resolveActionModelSelection, runAiPreviewRequest])

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
        case 'comment':
          toast.info('Select text and use the comment sidebar to add comments')
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

  // ── Custom AI model selection ────────────────────────────────────────────

  const customActionModelSelection = resolveActionModelSelection('custom')

  // ── Toolbar callback stability ──────────────────────────────────────────

  const handleRichChange = React.useCallback(() => {
    if (!editor) return
    const html = editor.getHTML()
    const md = htmlToMd(html)
    latestMdRef.current = md
    onChange(md)
  }, [editor, onChange])

  const handleAiDocumentActionWrapper = React.useCallback(
    (action: AiTransformAction, options?: { targetLanguage?: string }) => {
      void handleAiDocumentAction(action, options)
    },
    [handleAiDocumentAction],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-md border border-border/75 bg-card/95',
        className,
      )}
    >
        {/* Screen reader announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {a11yAnnouncement}
        </div>

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
          onRichChange={handleRichChange}
          insertPickerOpen={insertPickerOpen}
          onInsertPickerOpenChange={setInsertPickerOpen}
          onInsertSnippet={handleInsertSnippet}
          onInsertCodeBlock={handleInsertCodeBlock}
          activeAiLabel={activeModel?.label ?? activeModelId}
          aiDisabled={Boolean(ai.pendingAction) || !activeModelId}
          aiDocumentPendingAction={aiDocumentPendingAction}
          onAiDocumentAction={handleAiDocumentActionWrapper}
        />

        {/* Find/Replace bar */}
        {editor && (
          <DocFindReplace
            editor={editor}
            open={findReplaceOpen}
            onOpenChange={setFindReplaceOpen}
          />
        )}

        {/* Editor area */}
        <div
          ref={resize.aiSplitPaneRef}
          style={
            ai.preview && aiSplitColumns
              ? ({ '--doc-ai-split-columns': aiSplitColumns } as React.CSSProperties)
              : undefined
          }
          className={cn(
            'group/ai-split-pane relative flex-1 min-h-0 grid grid-cols-1 motion-reduce:transition-none xl:transition-[grid-template-columns] xl:duration-300 xl:ease-[cubic-bezier(0.22,1,0.36,1)]',
            ai.preview              ? 'xl:[grid-template-columns:var(--doc-ai-split-columns)]'
              : 'xl:[grid-template-columns:minmax(0,1fr)]',
          )}
        >
        <motion.div
          layout
          transition={PANE_TRANSITION}
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
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div
              ref={resize.splitPaneRef}
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
                    transition={PANE_TRANSITION}
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
                              resize.handleSplitPaneScroll('rich', viewport, ta)
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
                            onLinkAction={openLinkInput}
                            onAiAction={handleAiAction}
                            onOpenAiCustomPrompt={handleOpenAiCustomPrompt}
                            aiPendingAction={ai.pendingAction}
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

                          {selectionInfo ? (
                            <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                              <span>
                                {selectionInfo.words} {selectionInfo.words === 1 ? 'word' : 'words'}
                              </span>
                              <span className="opacity-40">/</span>
                              <span>
                                {selectionInfo.chars} {selectionInfo.chars === 1 ? 'char' : 'chars'}
                              </span>
                            </div>
                          ) : editor ? (
                            <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[10px] font-medium text-muted-foreground/60 shadow-sm backdrop-blur-sm">
                              <span>{editor.storage.characterCount?.characters() ?? 0} chars</span>
                              <span className="opacity-40">/</span>
                              <span>{editor.storage.characterCount?.words() ?? 0} words</span>
                            </div>
                          ) : null}
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
                    transition={PANE_TRANSITION}
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
                  onMouseDown={resize.handleSplitPaneResizeStart}
                  onTouchStart={resize.handleSplitPaneResizeStart}
                  aria-label="Drag to resize split editors, click to swap sides"
                  title="Drag to resize split editors, click to swap sides"
                  className="absolute inset-y-0 z-40 hidden w-4 -translate-x-1/2 cursor-col-resize items-center justify-center touch-none md:flex"
                  style={{ left: `${resize.splitPaneRatio * 100}%` }}
                >
                  <span
                    className={cn(
                      'absolute h-full w-px bg-border/60 transition-colors duration-200',
                      resize.splitPaneResizeActive ? 'bg-foreground/45' : 'group-hover/split-pane:bg-foreground/28',
                    )}
                  />
                </button>
              ) : null}
            </div>
          </div>

          {/* Document width resize handle */}
          {!ai.preview && onDocumentWidthChange && typeof documentWidth === 'number' ? (
            <button
              type="button"
              onMouseDown={resize.handleDocumentResizeStart}
              onTouchStart={resize.handleDocumentResizeStart}
              aria-label="Resize document width"
              className={cn(
                'absolute inset-y-0 z-40 hidden cursor-col-resize items-center justify-center touch-none xl:flex',
                'w-4 right-0 translate-x-1/2',
              )}
            >
              <span
                className={cn(
                  'h-full w-px bg-border/60 transition-colors duration-200',
                  resize.documentResizeActive ? 'bg-foreground/45' : 'group-hover/document-pane:bg-foreground/28',
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
            ai.preview ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          aria-hidden={!ai.preview}
        >
          {ai.preview ? (
            <div
              className={cn(
                'flex h-full min-h-0 flex-col animate-in fade-in duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none',
                aiPreviewOnLeft ? 'slide-in-from-left-3' : 'slide-in-from-right-3',
              )}
            >
              <DocAiResultPanel
                scope={ai.preview.scope}
                action={ai.preview.action}
                resultText={ai.preview.resultText}
                modelLabel={ai.preview.modelLabel}
                modelId={ai.preview.modelId}
                targetLanguage={ai.preview.targetLanguage}
                customPrompt={ai.preview.customPrompt}
                pending={ai.pendingAction === ai.preview.action}
                onRetry={handleRetryAiPreview}
                onAccept={handleAcceptAiPreview}
                side={aiPreviewSide}
                onClose={() => handleAiPreviewOpenChange(false)}
              />
            </div>
          ) : null}
        </div>

        {/* AI split resize handle */}
        {ai.preview ? (
          <button
            type="button"
            onMouseDown={resize.handleDocumentResizeStart}
            onTouchStart={resize.handleDocumentResizeStart}
            aria-label="Drag to resize AI split panes, click to swap sides"
            title="Drag to resize AI split panes, click to swap sides"
            className="absolute inset-y-0 z-40 hidden w-4 -translate-x-1/2 cursor-col-resize items-center justify-center touch-none xl:flex"
            style={{ left: `${aiSplitDividerPosition * 100}%` }}
          >
            <span
              className={cn(
                'absolute h-full w-px bg-border/60 transition-colors duration-200',
                resize.documentResizeActive ? 'bg-foreground/45' : 'group-hover/ai-split-pane:bg-foreground/28',
              )}
            />
          </button>
        ) : null}

        {/* Custom AI Prompt Dialog */}
        <Dialog
          open={ai.customPromptOpen}
          onOpenChange={(open) => {
            if (!open) {
              customPromptSelectionRef.current = null
              dispatchAi({ type: 'CLOSE_CUSTOM_PROMPT' })
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
              <Badge variant="outline">{ai.customPromptSelectionText.length} selected characters</Badge>
            </div>

            <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Selected text
              </p>
              <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
                {ai.customPromptSelectionText}
              </p>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="custom-ai-prompt">Prompt</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="custom-ai-prompt"
                    value={ai.customPromptValue}
                    onChange={(event) => dispatchAi({ type: 'SET_CUSTOM_PROMPT_VALUE', value: event.target.value })}
                    className="min-h-36 leading-6"
                    placeholder="Example: Rewrite this into a concise changelog for release notes, keep all technical terms and bullet structure."
                    maxLength={MAX_AI_CUSTOM_PROMPT_LENGTH}
                    autoFocus
                  />
                  <FieldDescription>
                    Be explicit about tone, format, constraints, or what should stay unchanged.
                    {` ${ai.customPromptValue.length} / ${MAX_AI_CUSTOM_PROMPT_LENGTH}`}
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => dispatchAi({ type: 'CLOSE_CUSTOM_PROMPT' })}>
                Cancel
              </Button>
              <Button onClick={() => void handleSubmitCustomPrompt()} disabled={!ai.customPromptValue.trim()}>
                <Sparkles data-icon="inline-start" />
                Run prompt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />

        {/* Inline link input dialog */}
        <Dialog open={linkInputOpen} onOpenChange={(open) => {
          if (!open) { setLinkInputOpen(false); setLinkInputUrl('') }
        }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Insert Link</DialogTitle>
              <DialogDescription>Enter the URL for this link.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); submitLinkInput() }}>
              <input
                type="url"
                value={linkInputUrl}
                onChange={(e) => setLinkInputUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setLinkInputOpen(false); setLinkInputUrl('') }}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!linkInputUrl.trim()}>
                  Insert
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <DocHeatmapEditorDialog
          open={heatmapEditorOpen}
          data={null}
          onOpenChange={(open) => {
            setHeatmapEditorOpen(open)
          }}
          onSave={handleHeatmapSave}
        />
      </div>
    </div>
  )
}
