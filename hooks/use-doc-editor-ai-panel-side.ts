'use client'

import * as React from 'react'

import {
  DOC_EDITOR_AI_PANEL_SIDE_STORAGE_KEY,
  normalizeDocEditorAiPanelSide,
  type DocEditorAiPanelSide,
} from '@/lib/doc-editor-layout'

function readStoredDocEditorAiPanelSide() {
  if (typeof window === 'undefined') {
    return 'right' as DocEditorAiPanelSide
  }

  try {
    return normalizeDocEditorAiPanelSide(
      window.localStorage.getItem(DOC_EDITOR_AI_PANEL_SIDE_STORAGE_KEY),
    )
  } catch {
    return 'right' as DocEditorAiPanelSide
  }
}

function persistDocEditorAiPanelSide(side: DocEditorAiPanelSide) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(DOC_EDITOR_AI_PANEL_SIDE_STORAGE_KEY, side)
}

export function useDocEditorAiPanelSide() {
  const [aiPanelSide, setAiPanelSideState] =
    React.useState<DocEditorAiPanelSide>('right')

  React.useEffect(() => {
    setAiPanelSideState(readStoredDocEditorAiPanelSide())
  }, [])

  const setAiPanelSide = React.useCallback((nextSide: DocEditorAiPanelSide) => {
    const normalizedSide = normalizeDocEditorAiPanelSide(nextSide)

    setAiPanelSideState((currentSide) => {
      if (currentSide === normalizedSide) {
        return currentSide
      }

      persistDocEditorAiPanelSide(normalizedSide)
      return normalizedSide
    })
  }, [])

  const toggleAiPanelSide = React.useCallback(() => {
    setAiPanelSideState((currentSide) => {
      const nextSide = currentSide === 'left' ? 'right' : 'left'
      persistDocEditorAiPanelSide(nextSide)
      return nextSide
    })
  }, [])

  return {
    aiPanelSide,
    setAiPanelSide,
    toggleAiPanelSide,
  }
}
