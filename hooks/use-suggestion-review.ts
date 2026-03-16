'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import {
  type Suggestion,
  type SuggestionReviewState,
  type AiLoadingInfo,
  SUGGESTION_INITIAL_STATE,
  createSuggestion,
  nextPendingIndex,
  diffToSuggestions,
  buildDocTextWithPmMap,
} from '@/lib/suggestions'
import { updateSuggestionDecorations } from '@/lib/editor/suggestion-plugin'

// ── Reducer ─────────────────────────────────────────────────────

type ReviewAction =
  | { type: 'START_AI_LOADING'; info: AiLoadingInfo }
  | { type: 'CANCEL_AI_LOADING' }
  | { type: 'START_REVIEW'; suggestions: Suggestion[] }
  | { type: 'GO_NEXT' }
  | { type: 'GO_PREV' }
  | { type: 'RESOLVE_CURRENT'; resolution: 'accepted' | 'rejected' }
  | { type: 'ACCEPT_ALL' }
  | { type: 'REJECT_ALL' }
  | { type: 'UPDATE_SUGGESTIONS'; suggestions: Suggestion[]; currentIndex: number }
  | { type: 'CLOSE' }

function reviewReducer(
  state: SuggestionReviewState,
  action: ReviewAction,
): SuggestionReviewState {
  switch (action.type) {
    case 'START_AI_LOADING':
      return { ...SUGGESTION_INITIAL_STATE, aiLoading: action.info }

    case 'CANCEL_AI_LOADING':
      return SUGGESTION_INITIAL_STATE

    case 'START_REVIEW': {
      const idx = nextPendingIndex(action.suggestions, 0)
      return {
        suggestions: action.suggestions,
        currentIndex: idx >= 0 ? idx : 0,
        active: action.suggestions.length > 0,
        aiLoading: null,
      }
    }

    case 'GO_NEXT': {
      if (!state.active) return state
      const start = (state.currentIndex + 1) % state.suggestions.length
      const idx = nextPendingIndex(state.suggestions, start)
      return idx >= 0 ? { ...state, currentIndex: idx } : state
    }

    case 'GO_PREV': {
      if (!state.active) return state
      const len = state.suggestions.length
      // Search backwards
      for (let i = 1; i <= len; i++) {
        const idx = (state.currentIndex - i + len) % len
        if (state.suggestions[idx].status === 'pending') {
          return { ...state, currentIndex: idx }
        }
      }
      return state
    }

    case 'RESOLVE_CURRENT': {
      if (!state.active) return state
      const updated = state.suggestions.map((s, i) =>
        i === state.currentIndex ? { ...s, status: action.resolution } : s,
      ) as Suggestion[]
      const next = nextPendingIndex(
        updated,
        (state.currentIndex + 1) % updated.length,
      )
      return {
        ...state,
        suggestions: updated,
        currentIndex: next >= 0 ? next : state.currentIndex,
      }
    }

    case 'ACCEPT_ALL': {
      const updated = state.suggestions.map((s) =>
        s.status === 'pending' ? { ...s, status: 'accepted' as const } : s,
      )
      return { ...state, suggestions: updated }
    }

    case 'REJECT_ALL': {
      const updated = state.suggestions.map((s) =>
        s.status === 'pending' ? { ...s, status: 'rejected' as const } : s,
      )
      return { ...state, suggestions: updated }
    }

    case 'UPDATE_SUGGESTIONS': {
      return {
        ...state,
        suggestions: action.suggestions,
        currentIndex: action.currentIndex,
      }
    }

    case 'CLOSE':
      return SUGGESTION_INITIAL_STATE

    default:
      return state
  }
}

// ── Hook ────────────────────────────────────────────────────────

export function useSuggestionReview(editor: Editor | null) {
  const [state, dispatch] = React.useReducer(
    reviewReducer,
    SUGGESTION_INITIAL_STATE,
  )
  const wasEditableRef = React.useRef(true)

  // Sync decorations whenever state changes
  React.useEffect(() => {
    if (!editor) return
    updateSuggestionDecorations(editor, {
      suggestions: state.suggestions,
      currentIndex: state.currentIndex,
      active: state.active,
    })
  }, [editor, state.suggestions, state.currentIndex, state.active])

  // Scroll to focused suggestion
  React.useEffect(() => {
    if (!editor || !state.active) return
    const current = state.suggestions[state.currentIndex]
    if (!current || current.status !== 'pending') return

    const pos = Math.min(current.from, editor.state.doc.content.size)
    try {
      editor.commands.setTextSelection(pos)
      editor.commands.scrollIntoView()
    } catch {
      // Position might be invalid after edits — ignore
    }
  }, [editor, state.currentIndex, state.active, state.suggestions])

  // ── Actions ───────────────────────────────────────────────────

  const startReview = React.useCallback(
    (suggestions: Suggestion[]) => {
      if (!editor) return
      wasEditableRef.current = editor.isEditable
      editor.setEditable(false)
      dispatch({ type: 'START_REVIEW', suggestions })
    },
    [editor],
  )

  const startReviewFromAiRewrite = React.useCallback(
    (rewrittenMd: string, from: number, to: number) => {
      if (!editor) return false

      // Build plain text + PM position map for the affected range.
      // Using the editor's actual doc ensures the left side of the diff
      // exactly matches the position map.
      const { text: originalPlain, map: textToPmMap } =
        buildDocTextWithPmMap(editor.state.doc, from, to)

      // Only strip markdown on the AI result (right side)
      const rewrittenPlain = stripMarkdownForDiff(rewrittenMd)

      const suggestions = diffToSuggestions(
        originalPlain,
        rewrittenPlain,
        textToPmMap,
      )

      if (suggestions.length === 0) return false

      wasEditableRef.current = editor.isEditable
      editor.setEditable(false)
      dispatch({ type: 'START_REVIEW', suggestions })
      return true
    },
    [editor],
  )

  const startReviewFromAppend = React.useCallback(
    (insertPos: number, resultText: string) => {
      if (!editor || !resultText.trim()) return false

      const suggestion = createSuggestion({
        type: 'ai',
        from: insertPos,
        to: insertPos,
        originalText: '',
        replacementText: resultText,
      })

      wasEditableRef.current = editor.isEditable
      editor.setEditable(false)
      dispatch({ type: 'START_REVIEW', suggestions: [suggestion] })
      return true
    },
    [editor],
  )

  /** Whole-block replacement: one suggestion that deletes all original → inserts all new. */
  const startReviewFromBlockReplace = React.useCallback(
    (rewrittenMd: string, from: number, to: number) => {
      if (!editor) return false

      const originalText = editor.state.doc.textBetween(from, to, '\n')
      const replacementText = stripMarkdownForDiff(rewrittenMd)

      if (originalText === replacementText) return false

      const suggestion = createSuggestion({
        type: 'ai',
        from,
        to,
        originalText,
        replacementText,
      })

      wasEditableRef.current = editor.isEditable
      editor.setEditable(false)
      dispatch({ type: 'START_REVIEW', suggestions: [suggestion] })
      return true
    },
    [editor],
  )

  const startAiLoading = React.useCallback(
    (info: AiLoadingInfo) => {
      dispatch({ type: 'START_AI_LOADING', info })
    },
    [],
  )

  const cancelAiLoading = React.useCallback(() => {
    dispatch({ type: 'CANCEL_AI_LOADING' })
  }, [])

  const goNext = React.useCallback(
    () => dispatch({ type: 'GO_NEXT' }),
    [],
  )

  const goPrev = React.useCallback(
    () => dispatch({ type: 'GO_PREV' }),
    [],
  )

  const acceptCurrent = React.useCallback(() => {
    if (!editor || !state.active) return
    const current = state.suggestions[state.currentIndex]
    if (!current || current.status !== 'pending') return

    // Temporarily make editable to apply the change
    editor.setEditable(true)

    try {
      const { from, to } = current
      if (current.originalText && !current.replacementText) {
        // Pure deletion
        editor.chain().deleteRange({ from, to }).run()
      } else if (!current.originalText && current.replacementText) {
        // Pure insertion
        editor.chain().insertContentAt(from, current.replacementText).run()
      } else {
        // Replacement
        editor
          .chain()
          .deleteRange({ from, to })
          .insertContentAt(from, current.replacementText)
          .run()
      }

      // Remap positions of remaining suggestions
      const lengthDelta = current.replacementText.length - current.originalText.length
      const remapped = state.suggestions.map((s, i) => {
        if (i === state.currentIndex) {
          return { ...s, status: 'accepted' as const }
        }
        if (s.status !== 'pending') return s

        // Shift positions for suggestions after the current one
        if (s.from >= to) {
          return { ...s, from: s.from + lengthDelta, to: s.to + lengthDelta }
        }
        return s
      })

      const next = nextPendingIndex(
        remapped,
        (state.currentIndex + 1) % remapped.length,
      )

      dispatch({
        type: 'UPDATE_SUGGESTIONS',
        suggestions: remapped,
        currentIndex: next >= 0 ? next : state.currentIndex,
      })
    } finally {
      editor.setEditable(false)
    }
  }, [editor, state])

  const rejectCurrent = React.useCallback(() => {
    dispatch({ type: 'RESOLVE_CURRENT', resolution: 'rejected' })
  }, [])

  const acceptAll = React.useCallback(() => {
    if (!editor || !state.active) return

    editor.setEditable(true)

    try {
      // Apply all pending suggestions from end to start to preserve positions
      const pending = state.suggestions
        .map((s, i) => ({ suggestion: s, index: i }))
        .filter(({ suggestion }) => suggestion.status === 'pending')
        .sort((a, b) => b.suggestion.from - a.suggestion.from)

      for (const { suggestion } of pending) {
        const { from, to } = suggestion
        if (suggestion.originalText && !suggestion.replacementText) {
          editor.chain().deleteRange({ from, to }).run()
        } else if (!suggestion.originalText && suggestion.replacementText) {
          editor.chain().insertContentAt(from, suggestion.replacementText).run()
        } else {
          editor
            .chain()
            .deleteRange({ from, to })
            .insertContentAt(from, suggestion.replacementText)
            .run()
        }
      }

      dispatch({ type: 'ACCEPT_ALL' })
    } finally {
      editor.setEditable(false)
    }
  }, [editor, state])

  const rejectAll = React.useCallback(() => {
    dispatch({ type: 'REJECT_ALL' })
  }, [])

  const closeReview = React.useCallback(() => {
    if (editor) {
      editor.setEditable(wasEditableRef.current)
      // Clear decorations
      updateSuggestionDecorations(editor, {
        suggestions: [],
        currentIndex: 0,
        active: false,
      })
    }
    dispatch({ type: 'CLOSE' })
  }, [editor])

  // Auto-close when all suggestions are resolved
  React.useEffect(() => {
    if (!state.active) return
    const hasPending = state.suggestions.some((s) => s.status === 'pending')
    if (!hasPending) {
      // Small delay so the user can see the final state
      const timer = setTimeout(closeReview, 400)
      return () => clearTimeout(timer)
    }
  }, [state.active, state.suggestions, closeReview])

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!state.active) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            goPrev()
          } else {
            goNext()
          }
          break
        case 'Enter':
        case 'y':
        case 'Y':
          e.preventDefault()
          acceptCurrent()
          break
        case 'Backspace':
        case 'n':
        case 'N':
          e.preventDefault()
          rejectCurrent()
          break
        case 'Escape':
          e.preventDefault()
          closeReview()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.active, goNext, goPrev, acceptCurrent, rejectCurrent, closeReview])

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed) {
        editor.setEditable(wasEditableRef.current)
        updateSuggestionDecorations(editor, {
          suggestions: [],
          currentIndex: 0,
          active: false,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    state,
    startReview,
    startReviewFromAiRewrite,
    startReviewFromBlockReplace,
    startReviewFromAppend,
    startAiLoading,
    cancelAiLoading,
    goNext,
    goPrev,
    acceptCurrent,
    rejectCurrent,
    acceptAll,
    rejectAll,
    closeReview,
  }
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Minimal markdown stripping for diff comparison.
 * Removes common markdown syntax so the diff focuses on content changes.
 */
function stripMarkdownForDiff(md: string): string {
  return (
    md
      // Remove heading markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove link syntax, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove image syntax
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove blockquote markers
      .replace(/^>\s+/gm, '')
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
