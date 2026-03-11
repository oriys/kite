export const AI_TRANSFORM_ACTIONS = [
  'polish',
  'shorten',
  'expand',
  'translate',
  'explain',
] as const

export type AiTransformAction = (typeof AI_TRANSFORM_ACTIONS)[number]

export const AI_ACTION_LABELS: Record<AiTransformAction, string> = {
  polish: 'Polish',
  shorten: 'Shorten',
  expand: 'Expand',
  translate: 'Translate',
  explain: 'Explain',
}

export const MAX_AI_TRANSFORM_TEXT_LENGTH = 8_000

export interface AiTransformRequest {
  action: AiTransformAction
  text: string
  targetLanguage?: string
}

export interface AiTransformResponse {
  result: string
}
