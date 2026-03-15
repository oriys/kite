import * as React from 'react'
import type { AiTransformAction } from '@/lib/ai'
import type { AiPreviewState } from '@/lib/editor/editor-helpers'

export type AiState = {
  pendingAction: AiTransformAction | null
  pendingScope: 'selection' | 'document' | null
  preview: AiPreviewState | null
  customPromptOpen: boolean
  customPromptValue: string
  customPromptSelectionText: string
}

export type AiAction =
  | { type: 'SET_PENDING'; action: AiTransformAction | null; scope: 'selection' | 'document' | null }
  | { type: 'SET_PREVIEW'; preview: AiPreviewState | null }
  | { type: 'SET_PREVIEW_RESULT'; resultText: string }
  | { type: 'OPEN_CUSTOM_PROMPT'; selectionText: string }
  | { type: 'CLOSE_CUSTOM_PROMPT' }
  | { type: 'SET_CUSTOM_PROMPT_VALUE'; value: string }
  | { type: 'RESET' }

const AI_INITIAL_STATE: AiState = {
  pendingAction: null,
  pendingScope: null,
  preview: null,
  customPromptOpen: false,
  customPromptValue: '',
  customPromptSelectionText: '',
}

function aiReducer(state: AiState, action: AiAction): AiState {
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
      return AI_INITIAL_STATE
    default:
      return state
  }
}

export function useAiState() {
  return React.useReducer(aiReducer, AI_INITIAL_STATE)
}
