'use client'

import * as React from 'react'

import {
  clampDocEditorWidth,
  DOC_EDITOR_WIDTH_DEFAULT,
  DOC_EDITOR_WIDTH_STORAGE_KEY,
} from '@/lib/doc-editor-layout'

function readStoredDocEditorWidth() {
  if (typeof window === 'undefined') {
    return DOC_EDITOR_WIDTH_DEFAULT
  }

  try {
    const raw = window.localStorage.getItem(DOC_EDITOR_WIDTH_STORAGE_KEY)

    if (!raw) {
      return DOC_EDITOR_WIDTH_DEFAULT
    }

    return clampDocEditorWidth(Number(raw))
  } catch {
    return DOC_EDITOR_WIDTH_DEFAULT
  }
}

function persistDocEditorWidth(width: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    DOC_EDITOR_WIDTH_STORAGE_KEY,
    String(clampDocEditorWidth(width)),
  )
}

export function useDocEditorWidth() {
  const [documentWidth, setDocumentWidthState] = React.useState(DOC_EDITOR_WIDTH_DEFAULT)

  React.useEffect(() => {
    setDocumentWidthState(readStoredDocEditorWidth())
  }, [])

  const setDocumentWidth = React.useCallback((nextWidth: number) => {
    const normalizedWidth = clampDocEditorWidth(nextWidth)

    setDocumentWidthState((currentWidth) => {
      if (currentWidth === normalizedWidth) {
        return currentWidth
      }

      persistDocEditorWidth(normalizedWidth)
      return normalizedWidth
    })
  }, [])

  const resetDocumentWidth = React.useCallback(() => {
    setDocumentWidth(DOC_EDITOR_WIDTH_DEFAULT)
  }, [setDocumentWidth])

  return {
    documentWidth,
    setDocumentWidth,
    resetDocumentWidth,
  }
}
