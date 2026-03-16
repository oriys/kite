import { DEFAULT_AI_SYSTEM_PROMPT } from '@/lib/ai-prompts'

export const AI_AUTOCOMPLETE_SURFACES = ['rich', 'source'] as const
export type AiAutocompleteSurface = (typeof AI_AUTOCOMPLETE_SURFACES)[number]

export const AI_AUTOCOMPLETE_DEBOUNCE_MS = 350
export const AI_AUTOCOMPLETE_MIN_PREFIX_CHARS = 24
export const AI_AUTOCOMPLETE_PREFIX_WINDOW_CHARS = 4_000
export const AI_AUTOCOMPLETE_SUFFIX_WINDOW_CHARS = 1_200
export const AI_AUTOCOMPLETE_MAX_SUGGESTION_CHARS = 240
export const AI_AUTOCOMPLETE_MAX_SUGGESTION_LINES = 3
export const AI_AUTOCOMPLETE_MAX_LANGUAGE_LENGTH = 40

export interface AiAutocompleteRequest {
  prefix: string
  suffix: string
  model?: string
  systemPrompt?: string
  surface?: AiAutocompleteSurface
  language?: string
}

export interface AiAutocompleteContext {
  prefix: string
  suffix: string
  surface: AiAutocompleteSurface
  language?: string
}

export function isAiAutocompleteSurface(value: string): value is AiAutocompleteSurface {
  return AI_AUTOCOMPLETE_SURFACES.includes(value as AiAutocompleteSurface)
}

export function sliceAiAutocompletePrefix(value: string) {
  return value.slice(-AI_AUTOCOMPLETE_PREFIX_WINDOW_CHARS)
}

export function sliceAiAutocompleteSuffix(value: string) {
  return value.slice(0, AI_AUTOCOMPLETE_SUFFIX_WINDOW_CHARS)
}

export function buildAiAutocompleteSystemPrompt(baseSystemPrompt?: string) {
  const base = baseSystemPrompt?.trim() || DEFAULT_AI_SYSTEM_PROMPT

  return [
    base,
    'You are serving inline autocomplete inside a document editor.',
    'Return only the exact text to insert at the cursor.',
    'Do not explain, summarize, label, or wrap the answer in markdown fences, XML tags, or quotes unless the surrounding context clearly requires those characters.',
    'Keep the completion short, locally consistent, and easy to accept.',
    'Avoid repeating text that already appears immediately before or after the cursor.',
    'If there is no strong continuation, return an empty string.',
  ].join(' ')
}

export function buildAiAutocompleteUserPrompt(input: AiAutocompleteContext) {
  const surfaceLabel =
    input.surface === 'source' ? 'Markdown source editor' : 'Rich text document editor'

  return [
    `Surface: ${surfaceLabel}`,
    `Language: ${(input.language || 'markdown').slice(0, AI_AUTOCOMPLETE_MAX_LANGUAGE_LENGTH)}`,
    '',
    'Complete the content exactly at the cursor position.',
    'Prefer the smallest useful continuation: finish the current phrase, sentence, list item, or short structural continuation.',
    input.suffix.trim()
      ? 'Respect the suffix and do not repeat text that already exists after the cursor.'
      : 'The cursor is at the end of the current visible content.',
    '',
    '<prefix>',
    input.prefix,
    '</prefix>',
    '',
    '<suffix>',
    input.suffix,
    '</suffix>',
  ].join('\n')
}

export function createAiAutocompleteContextKey(
  input: AiAutocompleteContext & { modelId: string; systemPrompt?: string },
) {
  return JSON.stringify([
    input.modelId,
    input.surface,
    input.language || '',
    input.systemPrompt || '',
    input.prefix,
    input.suffix,
  ])
}

export function normalizeAiAutocompleteSuggestion(input: {
  text: string
  prefix: string
  suffix: string
  maxChars?: number
  maxLines?: number
}) {
  const maxChars = input.maxChars ?? AI_AUTOCOMPLETE_MAX_SUGGESTION_CHARS
  const maxLines = input.maxLines ?? AI_AUTOCOMPLETE_MAX_SUGGESTION_LINES

  let next = input.text.replace(/\r\n?/g, '\n')
  next = unwrapFencedAutocomplete(next)
  next = trimSharedPrefix(input.prefix, next)
  next = trimSharedSuffix(next, input.suffix)
  next = limitAutocompleteLines(next, maxLines)
  next = limitAutocompleteChars(next, maxChars)

  return next.trimEnd()
}

function unwrapFencedAutocomplete(value: string) {
  const fencedMatch = value.match(/^```[^\n]*\n([\s\S]*?)\n```$/)
  return fencedMatch ? fencedMatch[1] : value
}

function trimSharedPrefix(prefix: string, suggestion: string) {
  const maxOverlap = Math.min(prefix.length, suggestion.length, 160)

  for (let size = maxOverlap; size > 0; size -= 1) {
    if (prefix.slice(-size) === suggestion.slice(0, size)) {
      return suggestion.slice(size)
    }
  }

  return suggestion
}

function trimSharedSuffix(suggestion: string, suffix: string) {
  const maxOverlap = Math.min(suggestion.length, suffix.length, 160)

  for (let size = maxOverlap; size > 0; size -= 1) {
    if (suggestion.slice(-size) === suffix.slice(0, size)) {
      return suggestion.slice(0, suggestion.length - size)
    }
  }

  return suggestion
}

function limitAutocompleteLines(value: string, maxLines: number) {
  const lines = value.split('\n')
  if (lines.length <= maxLines) return value
  return lines.slice(0, maxLines).join('\n')
}

function limitAutocompleteChars(value: string, maxChars: number) {
  if (value.length <= maxChars) return value

  const sliced = value.slice(0, maxChars)
  const minBoundary = Math.floor(maxChars * 0.6)
  const candidateCuts = [
    sliced.lastIndexOf('\n'),
    toInclusiveCut(sliced, '. '),
    toInclusiveCut(sliced, '! '),
    toInclusiveCut(sliced, '? '),
    toInclusiveCut(sliced, ', '),
    sliced.lastIndexOf(' '),
  ].filter((index) => index >= minBoundary)

  if (candidateCuts.length === 0) {
    return sliced.trimEnd()
  }

  return sliced.slice(0, Math.max(...candidateCuts)).trimEnd()
}

function toInclusiveCut(value: string, token: string) {
  const index = value.lastIndexOf(token)
  return index >= 0 ? index + 1 : -1
}
