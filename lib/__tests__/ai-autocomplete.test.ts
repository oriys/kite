import { describe, expect, it } from 'vitest'

import {
  AI_AUTOCOMPLETE_MAX_SUGGESTION_CHARS,
  AI_AUTOCOMPLETE_MAX_SUGGESTION_LINES,
  buildAiAutocompleteSystemPrompt,
  buildAiAutocompleteUserPrompt,
  normalizeAiAutocompleteSuggestion,
} from '@/lib/ai-autocomplete'

describe('ai autocomplete helpers', () => {
  it('trims repeated prefix echoes from streamed suggestions', () => {
    const suggestion = normalizeAiAutocompleteSuggestion({
      prefix: 'The API supports',
      suffix: '',
      text: 'supports pagination with cursor-based navigation.',
    })

    expect(suggestion).toBe(' pagination with cursor-based navigation.')
  })

  it('trims suffix overlap to avoid duplicating existing text', () => {
    const suggestion = normalizeAiAutocompleteSuggestion({
      prefix: 'Return the response',
      suffix: ' for successful requests.',
      text: ' for successful requests.',
    })

    expect(suggestion).toBe('')
  })

  it('bounds autocomplete output to the configured size', () => {
    const suggestion = normalizeAiAutocompleteSuggestion({
      prefix: 'Write the next paragraph about deployment readiness.',
      suffix: '',
      text: `Line one.\nLine two.\nLine three.\nLine four ${'x'.repeat(
        AI_AUTOCOMPLETE_MAX_SUGGESTION_CHARS,
      )}`,
    })

    expect(suggestion.split('\n').length).toBeLessThanOrEqual(
      AI_AUTOCOMPLETE_MAX_SUGGESTION_LINES,
    )
    expect(suggestion.length).toBeLessThanOrEqual(
      AI_AUTOCOMPLETE_MAX_SUGGESTION_CHARS,
    )
  })

  it('builds a prompt tailored to inline autocomplete', () => {
    const systemPrompt = buildAiAutocompleteSystemPrompt()
    const userPrompt = buildAiAutocompleteUserPrompt({
      prefix: '## Authentication\n\nThe client sends',
      suffix: '',
      surface: 'source',
      language: 'markdown',
    })

    expect(systemPrompt).toContain('inline autocomplete')
    expect(userPrompt).toContain('<prefix>')
    expect(userPrompt).toContain('<suffix>')
    expect(userPrompt).toContain('Markdown source editor')
  })
})
