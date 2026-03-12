'use client'

import * as React from 'react'
import {
  type SplitPaneLeading,
  type SplitPaneScrollSource,
  clamp,
  writeStorage,
  getScrollableProgress,
  setScrollableProgress,
  DOC_SPLIT_RATIO_STORAGE_KEY,
  DOC_SPLIT_LEADING_STORAGE_KEY,
  DOC_AI_SPLIT_RATIO_STORAGE_KEY,
  DOC_SPLIT_RATIO_MIN,
  DOC_SPLIT_RATIO_MAX,
  DOC_SPLIT_RATIO_DEFAULT,
  DOC_AI_SPLIT_RATIO_MIN,
  DOC_AI_SPLIT_RATIO_MAX,
  DOC_AI_SPLIT_RATIO_DEFAULT,
  readSplitPaneRatio,
  readSplitPaneLeading,
  readAiSplitRatio,
} from '@/lib/editor/editor-helpers'
import type { DocEditorAiPanelSide } from '@/lib/doc-editor-layout'

interface UseEditorResizeOptions {
  documentWidth?: number
  onDocumentWidthChange?: (width: number) => void
  aiPreviewSide: DocEditorAiPanelSide
  onAiPreviewSideChange?: (side: DocEditorAiPanelSide) => void
  hasAiPreview: boolean
}

export function useEditorResize({
  documentWidth,
  onDocumentWidthChange,
  aiPreviewSide,
  onAiPreviewSideChange,
  hasAiPreview,
}: UseEditorResizeOptions) {
  const [documentResizeActive, setDocumentResizeActive] = React.useState(false)
  const [splitPaneResizeActive, setSplitPaneResizeActive] = React.useState(false)
  const [splitPaneRatio, setSplitPaneRatio] = React.useState(readSplitPaneRatio)
  const [aiSplitRatio, setAiSplitRatio] = React.useState(readAiSplitRatio)
  const [splitPaneLeading, setSplitPaneLeading] = React.useState<SplitPaneLeading>(readSplitPaneLeading)

  const splitPaneRef = React.useRef<HTMLDivElement>(null)
  const aiSplitPaneRef = React.useRef<HTMLDivElement>(null)

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

  // ── Scroll sync ───────────────────────────────────────────────────────────

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

  // ── Split pane resize ─────────────────────────────────────────────────────

  const handleSplitPaneResizeStart = React.useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault()
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    splitPaneResizeRef.current = {
      startClientX: clientX,
      startRatio: splitPaneRatio,
      dragged: false,
    }
    setSplitPaneResizeActive(true)
  }, [splitPaneRatio])

  React.useEffect(() => {
    if (!splitPaneResizeActive) return
    const onMove = (e: MouseEvent | TouchEvent) => {
      const ref = splitPaneResizeRef.current
      const pane = splitPaneRef.current
      if (!ref || !pane) return
      ref.dragged = true
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const dx = clientX - ref.startClientX
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
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
  }, [splitPaneResizeActive, splitPaneLeading, splitPaneRatio])

  // ── Document / AI pane resize ─────────────────────────────────────────────

  const handleDocumentResizeStart = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
      const canResizeAi = hasAiPreview && Boolean(aiSplitPaneRef.current)
      const canResizeDoc = !hasAiPreview && typeof documentWidth === 'number' && Boolean(onDocumentWidthChange)
      if (!canResizeAi && !canResizeDoc) return

      event.preventDefault()
      event.stopPropagation()

      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
      documentResizeRef.current = {
        startClientX: clientX,
        startValue: canResizeAi ? aiSplitRatio : documentWidth ?? 0,
        mode: canResizeAi ? 'ai-preview' : 'document',
        dragged: false,
      }
      setDocumentResizeActive(true)
    },
    [hasAiPreview, aiSplitRatio, documentWidth, onDocumentWidthChange],
  )

  React.useEffect(() => {
    if (!documentResizeActive) return
    const onMove = (e: MouseEvent | TouchEvent) => {
      const ref = documentResizeRef.current
      if (!ref) return
      ref.dragged = true
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      if (ref.mode === 'ai-preview') {
        const pane = aiSplitPaneRef.current
        if (!pane) return
        const dx = clientX - ref.startClientX
        const paneWidth = pane.offsetWidth
        if (paneWidth <= 0) return
        const next = clamp(ref.startValue + dx / paneWidth, DOC_AI_SPLIT_RATIO_MIN, DOC_AI_SPLIT_RATIO_MAX, DOC_AI_SPLIT_RATIO_DEFAULT)
        setAiSplitRatio(next)
      } else {
        const dx = clientX - ref.startClientX
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
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
  }, [documentResizeActive, aiSplitRatio, aiPreviewSide, onAiPreviewSideChange, onDocumentWidthChange])

  return {
    // State
    documentResizeActive,
    splitPaneResizeActive,
    splitPaneRatio,
    aiSplitRatio,
    splitPaneLeading,
    // Refs
    splitPaneRef,
    aiSplitPaneRef,
    // Handlers
    handleSplitPaneScroll,
    handleSplitPaneResizeStart,
    handleDocumentResizeStart,
  }
}
