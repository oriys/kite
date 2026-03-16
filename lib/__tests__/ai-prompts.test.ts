import { describe, expect, it } from 'vitest'

import { createDefaultAiPromptSettings } from '@/lib/ai-prompts'

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
})
