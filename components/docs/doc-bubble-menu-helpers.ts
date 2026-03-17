import type { AiTransformAction } from '@/lib/ai'

export interface BubbleMenuPosition {
  top: number
  left: number
}

export type AiFlyoutPanel = 'models' | 'languages' | 'tones' | 'prompts' | null

export type AiFlyoutDirection = 'right' | 'left' | 'bottom'

export const MENU_VIEWPORT_PADDING = 8
export const MENU_SELECTION_GAP = 12
export const MENU_FALLBACK_HEIGHT = 44
export const MENU_FALLBACK_WIDTH = 220
export const MENU_HORIZONTAL_PADDING = 24
export const AI_MENU_FLYOUT_GAP = 8
export const AI_MENU_MODELS_WIDTH = 288
export const AI_MENU_LANGUAGES_WIDTH = 224
const AI_MENU_TONES_WIDTH = 224
export const AI_MENU_PROMPTS_WIDTH = 416
export const AI_MENU_OPEN_DELAY = 140
export const AI_MENU_CLOSE_DELAY = 110

export const DEFAULT_SELECTION_AI_ACTIONS = [
  'polish',
  'tone',
  'autofix',
  'format',
  'shorten',
  'expand',
  'translate',
  'explain',
  'summarize',
  'diagram',
] as const satisfies readonly AiTransformAction[]

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isRectVisibleInViewport(rect: DOMRect, viewportRect: DOMRect) {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= viewportRect.top &&
    rect.top <= viewportRect.bottom &&
    rect.right >= viewportRect.left &&
    rect.left <= viewportRect.right
  )
}

export function getSelectionAnchorRect(range: Range, viewportRect: DOMRect) {
  const clientRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  )

  if (clientRects.length === 0) {
    return range.getBoundingClientRect()
  }

  const visibleRects = clientRects.filter((rect) =>
    isRectVisibleInViewport(rect, viewportRect),
  )
  const candidateRects = visibleRects.length > 0 ? visibleRects : clientRects

  return candidateRects.reduce((bestRect, rect) => {
    if (rect.top < bestRect.top - 1) return rect
    if (Math.abs(rect.top - bestRect.top) <= 1 && rect.left < bestRect.left) return rect
    return bestRect
  })
}

export function getAiFlyoutWidth(panel: Exclude<AiFlyoutPanel, null>) {
  switch (panel) {
    case 'models':
      return AI_MENU_MODELS_WIDTH
    case 'languages':
      return AI_MENU_LANGUAGES_WIDTH
    case 'tones':
      return AI_MENU_TONES_WIDTH
    case 'prompts':
      return AI_MENU_PROMPTS_WIDTH
  }
}
