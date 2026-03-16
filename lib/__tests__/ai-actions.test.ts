import { describe, expect, it } from 'vitest'

import {
  MAX_AI_CUSTOM_PROMPT_LENGTH,
  buildAiResultAutoFixPrompt,
  canAutoFixAiResult,
  isAiModifyingAction,
  shouldDirectReplaceAiResult,
  shouldUseAiResultPanel,
} from '@/lib/ai'

describe('ai action routing', () => {
  it('treats rewrite-style actions as modifying the source content', () => {
    expect(isAiModifyingAction('polish')).toBe(true)
    expect(isAiModifyingAction('format')).toBe(true)
    expect(isAiModifyingAction('translate')).toBe(true)
    expect(isAiModifyingAction('custom')).toBe(true)
  })

  it('routes non-mutating full-document actions to the side panel', () => {
    expect(shouldUseAiResultPanel('document', 'review')).toBe(true)
    expect(shouldUseAiResultPanel('document', 'score')).toBe(true)
    expect(shouldUseAiResultPanel('document', 'summarize')).toBe(true)
    expect(shouldUseAiResultPanel('document', 'outline')).toBe(true)
    expect(shouldUseAiResultPanel('document', 'checklist')).toBe(true)
    expect(shouldUseAiResultPanel('document', 'diagram')).toBe(true)
  })

  it('keeps mutating actions in diff review for full-document edits', () => {
    expect(shouldUseAiResultPanel('document', 'polish')).toBe(false)
    expect(shouldUseAiResultPanel('document', 'autofix')).toBe(false)
    expect(shouldUseAiResultPanel('document', 'format')).toBe(false)
    expect(shouldUseAiResultPanel('document', 'shorten')).toBe(false)
    expect(shouldUseAiResultPanel('document', 'expand')).toBe(false)
    expect(shouldUseAiResultPanel('document', 'translate')).toBe(false)
  })

  it('directly replaces the full document for markdown formatting', () => {
    expect(shouldDirectReplaceAiResult('document', 'format')).toBe(true)
    expect(shouldDirectReplaceAiResult('document', 'polish')).toBe(false)
    expect(shouldDirectReplaceAiResult('selection', 'format')).toBe(false)
  })

  it('enables auto-fix only for full-document review and score results', () => {
    expect(canAutoFixAiResult('document', 'review')).toBe(true)
    expect(canAutoFixAiResult('document', 'score')).toBe(true)
    expect(canAutoFixAiResult('document', 'summarize')).toBe(false)
    expect(canAutoFixAiResult('selection', 'review')).toBe(false)
  })

  it('builds a bounded auto-fix prompt from the result panel content', () => {
    const prompt = buildAiResultAutoFixPrompt('review', 'Fix this.\n'.repeat(500))

    expect(prompt).toContain('<analysis>')
    expect(prompt).toContain('</analysis>')
    expect(prompt.length).toBeLessThanOrEqual(MAX_AI_CUSTOM_PROMPT_LENGTH)
  })
})
