import { describe, expect, it } from 'vitest'

import {
  createDefaultAiPromptSettings,
  resolveAiActionPrompt,
} from '@/lib/ai-prompts'

describe('ai prompts', () => {
  it('asks markdown format to fix syntax and shape content into suitable markdown', () => {
    const prompts = createDefaultAiPromptSettings()

    expect(prompts.actionPrompts.format).toContain(
      'most appropriate Markdown structure',
    )
    expect(prompts.actionPrompts.format).toContain(
      'Preserve every word, sentence, fact, ordering, and meaning',
    )
  })

  it('resolves tone prompts with the chosen target tone', () => {
    const prompts = createDefaultAiPromptSettings()

    expect(
      resolveAiActionPrompt('tone', prompts, { targetTone: 'Professional' }),
    ).toContain('Professional tone')
  })

  it('keeps continue writing append-only', () => {
    const prompts = createDefaultAiPromptSettings()

    expect(prompts.actionPrompts.continueWriting).toContain(
      'Return only the new markdown to append',
    )
  })
})
