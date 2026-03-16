'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import {
  AI_ACTION_LABELS,
  MAX_AI_TRANSFORM_TEXT_LENGTH,
  buildAiResultAutoFixPrompt,
  canAutoFixAiResult,
  isAiAppendResultAction,
  isAiDiagramAction,
  isAiInlineDiffAction,
  isAiModifyingAction,
  isAiPreviewOnlyAction,
  isAiRewriteAction,
  shouldDirectReplaceAiResult,
  shouldUseAiResultPanel,
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
import { DocFindReplace } from '@/components/docs/doc-find-replace'
import {
  type AiPreviewRequest,
  type DocEditorProps,
  type EditorMode,
  DEFAULT_HEATMAP_SNIPPET,
  PANE_TRANSITION,
  hasRichEditor,
  hasRenderableMarkdown,
  hasSourceEditor,
  mdToHtml,
  appendAiResultToDocument,
  sourceWrap,
} from '@/lib/editor/editor-helpers'
import { useEditorResize } from '@/hooks/use-editor-resize'
import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPrompts } from '@/hooks/use-ai-prompts'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { DocAiResultPanel } from '@/components/docs/doc-ai-result-panel'
import { DocHeatmapEditorDialog } from '@/components/docs/doc-heatmap-editor-dialog'
import { DocToolbar, type EditorViewMode, type ToolbarMode } from '@/components/docs/doc-toolbar'
import { DocBubbleMenu } from '@/components/docs/doc-bubble-menu'
import { DocSlashMenu } from '@/components/docs/doc-slash-menu'
import { DocSuggestionToolbar } from '@/components/docs/doc-suggestion-toolbar'
import { wordCount } from '@/lib/utils'
import { createEditorExtensions } from '@/components/docs/doc-editor-extensions'
import { aiReducer, AI_INITIAL_STATE } from '@/components/docs/doc-editor-hooks'
import { CustomAiPromptDialog, LinkInputDialog, FloatingStatsPill } from '@/components/docs/doc-editor-panes'
import { useSuggestionReview } from '@/hooks/use-suggestion-review'
import { useDocOutline } from '@/hooks/use-doc-outline'

export type { DocEditorHandle } from '@/lib/editor/editor-helpers'

// ── Main Editor Component ──────────────────────────────────────────────────

export function DocEditor({
  content,
  onChange,
  readOnly,
  readOnlyAiActions = [],
  commentsEnabled = true,
  statsOverlayContainerRef,
  className,
  onModeChange,
  editorFocusRef,
  onAiPreviewVisibilityChange,
  documentWidth,
  onDocumentWidthChange,
  onDocumentResizeStateChange,
  fullscreen = false,
  onFullscreenChange,
  aiPreviewSide = 'right',
  onAiPreviewSideChange,
  onComment,
  outlineOpen = false,
  onOutlineOpenChange,
}: DocEditorProps) {
  // ── AI model state ───────────────────────────────────────────────────────
  const {
    items: aiModels,
    loading: aiModelsLoading,
    defaultModelId,
    enabledModelIds: initialEnabledModelIds,
  } = useAiModels()
  const {
    enabledModels,
    activeModel,
    activeModelId,
    setActiveModelId,
  } = useAiPreferences(aiModels, defaultModelId, initialEnabledModelIds)
  const { prompts: aiPrompts } = useAiPrompts()
  const enabledModelIds = React.useMemo(() => enabledModels.map((m) => m.id), [enabledModels])

  // ── Editor mode state ────────────────────────────────────────────────────
  const [mode, setMode] = React.useState<EditorMode>('wysiwyg')
  const [activePane, setActivePane] = React.useState<ToolbarMode>('wysiwyg')

  // ── AI state (consolidated reducer to minimize re-renders) ───────────────
  const [ai, dispatchAi] = React.useReducer(aiReducer, AI_INITIAL_STATE)

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
  const statsPillContainerRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const latestMdRef = React.useRef(content)
  const switchingRef = React.useRef(false)
  const htmlToMdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestIdRef = React.useRef(0)
  const aiAbortControllerRef = React.useRef<AbortController | null>(null)
  const customPromptSelectionRef = React.useRef<{ from: number; to: number } | null>(null)
  const slashMenuRef = React.useRef<{ show: () => void; hide: () => void }>(null)
  const activeHeatmapPosRef = React.useRef<number | null>(null)

  const reducedMotion = useReducedMotion()
  const editingMode: ToolbarMode = mode === 'split' ? activePane : mode
  const aiDocumentPendingAction = ai.pendingScope === 'document' ? ai.pendingAction : null
  const readOnlyAiActionSet = React.useMemo(
    () => new Set<AiTransformAction>(readOnlyAiActions),
    [readOnlyAiActions],
  )
  const availableSelectionAiActions = React.useMemo(
    () =>
      readOnly
        ? readOnlyAiActions.filter(
            (action) => action === 'explain' || action === 'diagram',
          )
        : [],
    [readOnly, readOnlyAiActions],
  )
  const availableDocumentAiActions = React.useMemo(
    () => (readOnly ? readOnlyAiActions.filter((action) => action !== 'explain') : []),
    [readOnly, readOnlyAiActions],
  )
  const canShowSelectionAi = !readOnly || availableSelectionAiActions.length > 0
  const showAiSidePanel = Boolean(ai.preview)
  const wysiwygOnLeft = resize.splitPaneLeading === 'wysiwyg'
  const aiPreviewOnLeft = showAiSidePanel && aiPreviewSide === 'left'
  const splitPaneColumns = `minmax(0, ${resize.splitPaneRatio}fr) minmax(0, ${1 - resize.splitPaneRatio}fr)`
  const aiSplitColumns = showAiSidePanel
    ? aiPreviewOnLeft
      ? `minmax(0, ${resize.aiSplitRatio}fr) minmax(0, ${1 - resize.aiSplitRatio}fr)`
      : `minmax(0, ${1 - resize.aiSplitRatio}fr) minmax(0, ${resize.aiSplitRatio}fr)`
    : null
  const aiSplitDividerPosition = aiPreviewOnLeft ? resize.aiSplitRatio : 1 - resize.aiSplitRatio

  // ── Tiptap Editor ────────────────────────────────────────────────────────

  const editor = useEditor({
    immediatelyRender: false,
    content: mdToHtml(content),
    extensions: createEditorExtensions(),
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          'prose-editorial max-w-none outline-none',
          mode === 'split'
            ? 'h-full min-h-full p-6 md:p-7'
            : fullscreen
              ? 'min-h-full p-6'
              : 'min-h-[600px] p-6',
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

  // ── Suggestion review ───────────────────────────────────────────────────
  const suggestionReview = useSuggestionReview(editor)

  // ── Document outline ────────────────────────────────────────────────────
  const outline = useDocOutline(editor)

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
    const editorMd = htmlToMd(editor.getHTML())
    if (content !== latestMdRef.current || editorMd !== content) {
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
        flushPendingContent: () => {
          flushHtmlToMd()
          return latestMdRef.current
        },
        applyCommentMark: (from: number, to: number, commentId: string) => {
          if (!editor || from >= to) return
          const commentMark = editor.schema.marks.comment
          if (!commentMark) return

          const tr = editor.state.tr.addMark(
            from,
            to,
            commentMark.create({ commentId }),
          )
          tr.setSelection(TextSelection.create(tr.doc, to))

          editor.view.dispatch(tr)
        },
        getOutlineHeadings: () => outline.headings,
        getOutlineActiveId: () => outline.activeId,
        scrollToOutlineHeading: (heading) => outline.scrollToHeading(heading),
      }
    }
  }, [editor, editorFocusRef, flushHtmlToMd, outline])

  // ── Mode changes ─────────────────────────────────────────────────────────

  React.useEffect(() => { onModeChange?.(mode) }, [mode, onModeChange])
  React.useEffect(() => { onAiPreviewVisibilityChange?.(Boolean(ai.preview)) }, [ai.preview, onAiPreviewVisibilityChange])
  React.useEffect(
    () => () => {
      aiAbortControllerRef.current?.abort()
    },
    [],
  )
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
      aiAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      aiAbortControllerRef.current = abortController

      const isDiagram = isAiDiagramAction(request.action)
      const modifiesOriginal = isAiModifyingAction(request.action)
      const directReplaceResult = shouldDirectReplaceAiResult(
        request.scope,
        request.action,
      )
      const showResultPanel = shouldUseAiResultPanel(
        request.scope,
        request.action,
      )

      // Full-document non-mutating actions and preview-only actions stay in the side panel.
      // Mutating actions route into the suggestion/diff review flow.
      if (showResultPanel || directReplaceResult) {
        dispatchAi({ type: 'SET_PENDING', action: request.action, scope: request.scope })
        if (showResultPanel) {
          dispatchAi({ type: 'SET_PREVIEW', preview: { ...request, resultText: '' } })
        }
      }

      if (!showResultPanel && !directReplaceResult) {
        suggestionReview.startAiLoading({
          actionLabel: request.loadingActionLabel ?? AI_ACTION_LABELS[request.action],
          modelLabel: request.modelLabel,
        })
      }

      try {
        const actionPrompt = resolveAiActionPrompt(
          request.action,
          aiPrompts,
          request.targetLanguage,
        )

        const response = await fetch('/api/ai/transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
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

        // Diagram actions: stream result into side panel
        if (isDiagram) {
          if (!response.body) {
            throw new Error('The AI provider did not return a diagram stream.')
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let streamedText = ''

          announce('AI diagram is streaming')

          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              streamedText += decoder.decode()
              break
            }

            streamedText += decoder.decode(value, { stream: true })

            if (requestId !== aiRequestIdRef.current) {
              await reader.cancel()
              return
            }

            dispatchAi({ type: 'SET_PREVIEW_RESULT', resultText: streamedText })
          }

          if (requestId !== aiRequestIdRef.current) return

          dispatchAi({ type: 'SET_PREVIEW_RESULT', resultText: streamedText })
          announce('AI diagram ready for review')
          return
        }

        // Non-mutating document actions: show result in the side panel
        if (showResultPanel) {
          const data = (await response.json()) as { result: string }
          if (requestId !== aiRequestIdRef.current) return
          dispatchAi({ type: 'SET_PREVIEW_RESULT', resultText: data.result })
          announce('AI result ready for review')
          return
        }

        if (directReplaceResult) {
          const data = (await response.json()) as { result: string }
          if (requestId !== aiRequestIdRef.current) return
          if (!editor) return

          if (data.result === request.originalText) {
            toast.info('Markdown formatting already looks good', {
              description: 'No markdown fixes were needed.',
            })
            announce('Markdown formatting unchanged')
            return
          }

          editor.commands.setContent(mdToHtml(data.result), { emitUpdate: false })
          latestMdRef.current = data.result
          onChange(data.result)
          setSelectionInfo(null)
          toast.success('Markdown formatting applied')
          announce('Markdown formatting applied')
          return
        }

        // ── All other actions → decompose into suggestions ──────────
        const data = (await response.json()) as { result: string }
        if (requestId !== aiRequestIdRef.current) return

        if (!editor) {
          suggestionReview.cancelAiLoading()
          return
        }

        const resultText = data.result

        const sel = request.selectionRange
        const from = request.scope === 'document' ? 0 : sel?.from ?? 0
        const to = request.scope === 'document'
          ? editor.state.doc.content.size
          : sel?.to ?? editor.state.doc.content.size

        const shouldUseDiffReview =
          request.scope === 'document'
            ? modifiesOriginal
            : isAiInlineDiffAction(request.action)

        let reviewStarted = false

        if (shouldUseDiffReview) {
          // Full-document rewrites and inline edit actions use diff review.
          reviewStarted = suggestionReview.startReviewFromAiRewrite(
            resultText,
            from,
            to,
          )
        } else if (isAiRewriteAction(request.action)) {
          // Selection-only structural rewrites still use single block replacement suggestions.
          reviewStarted = suggestionReview.startReviewFromBlockReplace(
            resultText,
            from,
            to,
          )
        } else if (isAiAppendResultAction(request.action)) {
          // Append: single insertion suggestion
          const insertPos = request.scope === 'document'
            ? editor.state.doc.content.size
            : sel
              ? Math.min(sel.to, editor.state.doc.content.size)
              : editor.state.doc.content.size

          reviewStarted = suggestionReview.startReviewFromAppend(
            insertPos,
            resultText,
          )
        }

        if (!reviewStarted) {
          suggestionReview.cancelAiLoading()
          toast.info('No changes suggested', {
            description: 'The AI result matched the current content.',
          })
          announce('AI returned no changes')
          return
        }

        announce('AI changes ready for review')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (requestId !== aiRequestIdRef.current) return
        toast.error('AI transform failed', {
          description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        })

        if (showResultPanel) {
          dispatchAi({ type: 'SET_PREVIEW', preview: null })
        } else if (!directReplaceResult) {
          suggestionReview.cancelAiLoading()
        }
        announce('AI transform failed')
      } finally {
        if (aiAbortControllerRef.current === abortController) {
          aiAbortControllerRef.current = null
        }
        if (requestId === aiRequestIdRef.current) {
          dispatchAi({ type: 'SET_PENDING', action: null, scope: null })
        }
      }
    },
    [aiPrompts, announce, editor, onChange, suggestionReview],
  )

  const handleAiAction = React.useCallback(
    (action: AiTransformAction, options?: { targetLanguage?: string }) => {
      if (!editor) return
      if (readOnly && !readOnlyAiActionSet.has(action)) return
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
    [editor, readOnly, readOnlyAiActionSet, resolveActionModelSelection, runAiPreviewRequest],
  )

  const handleAiDocumentAction = React.useCallback(
    (action: AiTransformAction, options?: { targetLanguage?: string }) => {
      if (readOnly && !readOnlyAiActionSet.has(action)) return
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
    [readOnly, readOnlyAiActionSet, resolveActionModelSelection, runAiPreviewRequest],
  )

  const handleAiPreviewOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      aiAbortControllerRef.current?.abort()
      aiAbortControllerRef.current = null
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
      loadingActionLabel: ai.preview.loadingActionLabel,
      originalText: ai.preview.originalText,
      selectionRange: ai.preview.selectionRange,
      targetLanguage: ai.preview.targetLanguage,
      customPrompt: ai.preview.customPrompt,
    }
    void runAiPreviewRequest(request)
  }, [ai.preview, runAiPreviewRequest])

  const handleAutoFixAiPreview = React.useCallback(() => {
    if (
      !ai.preview ||
      !canAutoFixAiResult(ai.preview.scope, ai.preview.action) ||
      !ai.preview.resultText.trim() ||
      readOnly
    ) {
      return
    }

    const request: AiPreviewRequest = {
      scope: 'document',
      action: 'custom',
      modelId: ai.preview.modelId,
      modelLabel: ai.preview.modelLabel,
      loadingActionLabel:
        ai.preview.action === 'score'
          ? 'Applying score fixes'
          : 'Applying review fixes',
      originalText: latestMdRef.current,
      selectionRange: null,
      customPrompt: buildAiResultAutoFixPrompt(
        ai.preview.action,
        ai.preview.resultText,
      ),
    }

    handleAiPreviewOpenChange(false)
    requestAnimationFrame(() => {
      void runAiPreviewRequest(request)
    })
  }, [ai.preview, handleAiPreviewOpenChange, readOnly, runAiPreviewRequest])

  // Accept for diagram/preview-only actions (side panel path)
  const handleAcceptAiPreview = React.useCallback(() => {
    if (
      !ai.preview ||
      !ai.preview.resultText ||
      readOnly ||
      isAiPreviewOnlyAction(ai.preview.action)
    ) return

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
        const shouldInsertAsMarkdown = hasRenderableMarkdown(ai.preview!.resultText)

        if (shouldInsertAsMarkdown) {
          const resultHtml = mdToHtml(ai.preview!.resultText)
          editor
            .chain()
            .focus()
            .insertContentAt({ from: sel.from, to: sel.to }, resultHtml)
            .run()
        } else {
          editor
            .chain()
            .focus()
            .deleteRange({ from: sel.from, to: sel.to })
            .insertContentAt(sel.from, ai.preview!.resultText)
            .run()
        }
      }

      const html = editor.getHTML()
      const md = htmlToMd(html)
      latestMdRef.current = md
      onChange(md)
      setSelectionInfo(null)
    })
  }, [ai.preview, editor, handleAiPreviewOpenChange, onChange, readOnly])

  const handleCancelAiLoading = React.useCallback(() => {
    aiAbortControllerRef.current?.abort()
    aiAbortControllerRef.current = null
    aiRequestIdRef.current += 1
    suggestionReview.cancelAiLoading()
    dispatchAi({ type: 'SET_PENDING', action: null, scope: null })
  }, [suggestionReview])

  const handleOpenAiCustomPrompt = React.useCallback(() => {
    if (!editor || readOnly) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const text = editor.state.doc.textBetween(from, to, ' ')
    customPromptSelectionRef.current = { from, to }
    dispatchAi({ type: 'OPEN_CUSTOM_PROMPT', selectionText: text })
  }, [editor, readOnly])

  const handleSubmitCustomPrompt = React.useCallback(async () => {
    if (readOnly) return
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
  }, [ai.customPromptValue, ai.customPromptSelectionText, editor, readOnly, resolveActionModelSelection, runAiPreviewRequest])

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
        case 'comment': {
          if (!commentsEnabled) break
          if (!editor) break
          const { from, to } = editor.state.selection
          if (from === to) {
            toast.info('Select some text first to add a comment')
            break
          }
          const text = editor.state.doc.textBetween(from, to, ' ')
          onComment?.({ from, to, text })
          break
        }
      }
    },
    [commentsEnabled, editor, onComment],
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
        'relative flex min-h-0 flex-col overflow-hidden bg-card/95',
        fullscreen
          ? 'h-full flex-1 rounded-none border-0'
          : 'rounded-md border border-border/75',
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
          fullscreen={fullscreen}
          onFullscreenChange={onFullscreenChange}
          availableDocumentAiActions={readOnly ? availableDocumentAiActions : undefined}
          aiDocumentPendingAction={aiDocumentPendingAction}
          onAiDocumentAction={handleAiDocumentActionWrapper}
          outlineOpen={outlineOpen}
          onOutlineOpenChange={onOutlineOpenChange}
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
            showAiSidePanel && aiSplitColumns
              ? ({ '--doc-ai-split-columns': aiSplitColumns } as React.CSSProperties)
              : undefined
          }
          className={cn(
            'group/ai-split-pane relative flex-1 min-h-0 grid grid-cols-1 motion-reduce:transition-none xl:transition-[grid-template-columns] xl:duration-300 xl:ease-[cubic-bezier(0.22,1,0.36,1)]',
            showAiSidePanel
              ? 'xl:[grid-template-columns:var(--doc-ai-split-columns)]'
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
          <div
            ref={statsPillContainerRef}
            className="pointer-events-none absolute inset-0 z-30"
            aria-hidden="true"
          />
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
                      'h-full min-h-0 overflow-auto transition-[box-shadow] duration-200',
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
                    <div
                      ref={editorWrapperRef}
                      className="relative h-full min-h-full"
                    >
                      <EditorContent editor={editor} />

                      {hasRichEditor(mode) && editor && canShowSelectionAi && (
                        <>
                          <DocBubbleMenu
                            editorRef={editorWrapperRef}
                            onAction={handleBubbleAction}
                            onLinkAction={openLinkInput}
                            formattingEnabled={!readOnly}
                            commentsEnabled={!readOnly && commentsEnabled}
                            onAiAction={handleAiAction}
                            onOpenAiCustomPrompt={handleOpenAiCustomPrompt}
                            availableAiActions={readOnly ? availableSelectionAiActions : undefined}
                            allowCustomPrompt={!readOnly}
                            aiPendingAction={ai.pendingAction}
                            enabledModels={enabledModels}
                            activeModelId={activeModel?.id ?? activeModelId}
                            onActiveModelChange={setActiveModelId}
                            aiModelsLoading={aiModelsLoading}
                          />
                          {!readOnly ? (
                          <DocSlashMenu
                            ref={slashMenuRef}
                            editorRef={editorWrapperRef}
                            onSelect={handleSlashSelect}
                            onClose={handleSlashMenuClose}
                          />
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
                      'h-full min-h-0 overflow-auto transition-[box-shadow] duration-200',
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
                        mode === 'split'
                          ? fullscreen
                            ? 'h-full min-h-full p-5 md:p-6'
                            : 'h-full min-h-[600px] p-5 md:p-6'
                          : fullscreen
                            ? 'h-full min-h-full p-4'
                            : 'h-full min-h-[600px] p-4',
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

        {/* AI result pane for preview-only and non-mutating document actions */}
        <div
          className={cn(
            'h-full min-h-0 min-w-0 overflow-hidden motion-reduce:transition-none',
            aiPreviewOnLeft ? 'xl:order-1' : 'xl:order-2',
            showAiSidePanel ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          aria-hidden={!showAiSidePanel}
        >
          {showAiSidePanel && ai.preview ? (
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
                previewOnly={
                  readOnly || isAiPreviewOnlyAction(ai.preview.action)
                }
                onRetry={handleRetryAiPreview}
                onAccept={handleAcceptAiPreview}
                onAutoFix={
                  !readOnly &&
                  ai.preview.resultText.trim() &&
                  canAutoFixAiResult(ai.preview.scope, ai.preview.action)
                    ? handleAutoFixAiPreview
                    : undefined
                }
                side={aiPreviewSide}
                onClose={() => handleAiPreviewOpenChange(false)}
              />
            </div>
          ) : null}
        </div>

        {/* AI split resize handle */}
        {showAiSidePanel ? (
          <button
            type="button"
            onMouseDown={resize.handleAiPreviewResizeStart}
            onTouchStart={resize.handleAiPreviewResizeStart}
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
        <CustomAiPromptDialog
          open={ai.customPromptOpen}
          selectionText={ai.customPromptSelectionText}
          promptValue={ai.customPromptValue}
          modelLabel={resolveActionModelSelection('custom')?.modelLabel ?? null}
          onPromptChange={(value) => dispatchAi({ type: 'SET_CUSTOM_PROMPT_VALUE', value })}
          onClose={() => {
            customPromptSelectionRef.current = null
            dispatchAi({ type: 'CLOSE_CUSTOM_PROMPT' })
          }}
          onSubmit={() => void handleSubmitCustomPrompt()}
        />

        <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />

        {/* Inline link input dialog */}
        <LinkInputDialog
          open={linkInputOpen}
          url={linkInputUrl}
          onUrlChange={setLinkInputUrl}
          onClose={() => { setLinkInputOpen(false); setLinkInputUrl('') }}
          onSubmit={submitLinkInput}
        />

        <DocHeatmapEditorDialog
          open={heatmapEditorOpen}
          data={null}
          onOpenChange={(open) => {
            setHeatmapEditorOpen(open)
          }}
          onSave={handleHeatmapSave}
        />

        {!readOnly && editor && (
          <FloatingStatsPill
            editor={editor}
            selectionInfo={selectionInfo}
            statsOverlayContainerRef={statsPillContainerRef}
            fallbackStatsOverlayContainerRef={statsOverlayContainerRef}
          />
        )}

        {/* Suggestion review toolbar */}
        <DocSuggestionToolbar
          state={suggestionReview.state}
          onAcceptCurrent={suggestionReview.acceptCurrent}
          onRejectCurrent={suggestionReview.rejectCurrent}
          onAcceptAll={suggestionReview.acceptAll}
          onRejectAll={suggestionReview.rejectAll}
          onGoNext={suggestionReview.goNext}
          onGoPrev={suggestionReview.goPrev}
          onClose={suggestionReview.closeReview}
          onCancelAiLoading={handleCancelAiLoading}
        />
      </div>
    </div>
  )
}
