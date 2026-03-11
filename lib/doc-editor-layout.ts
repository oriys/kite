export type DocEditorAiPanelSide = 'left' | 'right'

export const DOC_EDITOR_WIDTH_STORAGE_KEY = 'doc-editor-width'
export const DOC_EDITOR_AI_PANEL_SIDE_STORAGE_KEY = 'doc-editor-ai-panel-side'
export const DOC_EDITOR_WIDTH_MIN = 880
export const DOC_EDITOR_WIDTH_MAX = 2000
export const DOC_EDITOR_WIDTH_STEP = 40
export const DOC_EDITOR_WIDTH_DEFAULT = 1760

export const DOC_EDITOR_WIDTH_PRESETS = [
  { label: 'Focused', value: 1280 },
  { label: 'Comfort', value: 1520 },
  { label: 'Wide', value: 1760 },
  { label: 'Full', value: 2000 },
] as const

export function clampDocEditorWidth(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return DOC_EDITOR_WIDTH_DEFAULT
  }

  const normalized = Math.round((value as number) / DOC_EDITOR_WIDTH_STEP) * DOC_EDITOR_WIDTH_STEP

  return Math.min(
    DOC_EDITOR_WIDTH_MAX,
    Math.max(DOC_EDITOR_WIDTH_MIN, normalized),
  )
}

export function normalizeDocEditorAiPanelSide(
  value: string | null | undefined,
): DocEditorAiPanelSide {
  return value === 'left' ? 'left' : 'right'
}

export function getDocEditorShellWidth(documentWidth: number) {
  return clampDocEditorWidth(documentWidth)
}
