import { describe, expect, it } from 'vitest'

import {
  buildDocAgentInteractivePagePrompt,
  parseDocAgentInteractivePageResponse,
  validateDocAgentInteractivePageSpec,
} from '@/lib/agent/interactive-page'
import {
  buildDocAgentInteractivePageTemplate,
  buildDocAgentInteractivePageTemplatePrompt,
  getDocAgentInteractivePagePreviewFromToolCall,
  parseDocAgentInteractivePageTemplateInput,
} from '@/lib/agent/interactive-page-templates'
import { buildAgentSystemPrompt } from '@/lib/agent/prompts'

describe('doc agent interactive page catalog', () => {
  const validSpec = {
    state: {
      form: {
        tone: 'reference',
        notes: '',
      },
    },
    root: 'page',
    elements: {
      page: {
        type: 'Page',
        props: {
          title: 'Pick a writing direction',
          description: 'Give the agent enough signal to continue without another round-trip.',
        },
        children: ['section', 'actions'],
      },
      section: {
        type: 'Section',
        props: {
          title: 'What do you want next?',
        },
        children: ['tone', 'notes'],
      },
      tone: {
        type: 'ChoiceGroup',
        props: {
          label: 'Tone',
          name: 'tone',
          value: { $bindState: '/form/tone' },
          options: [
            { label: 'Reference style', value: 'reference' },
            { label: 'Quick draft', value: 'draft' },
          ],
        },
        children: [],
      },
      notes: {
        type: 'TextArea',
        props: {
          label: 'Notes',
          name: 'notes',
          value: { $bindState: '/form/notes' },
          placeholder: 'Anything the agent should keep in mind?',
        },
        children: [],
      },
      actions: {
        type: 'ActionRow',
        props: {},
        children: ['submit'],
      },
      submit: {
        type: 'ActionButton',
        props: {
          label: 'Continue',
        },
        on: {
          press: {
            action: 'respond',
            params: {
              action: 'submit',
            },
          },
        },
        children: [],
      },
    },
  }

  it('accepts a valid interactive page spec', () => {
    const result = validateDocAgentInteractivePageSpec(validSpec)
    expect(result.success).toBe(true)
  })

  it('auto-fixes visibility misplaced inside props', () => {
    const result = validateDocAgentInteractivePageSpec({
      ...validSpec,
      elements: {
        ...validSpec.elements,
        notes: {
          ...validSpec.elements.notes,
          props: {
            ...validSpec.elements.notes.props,
            visible: { $state: '/form/tone', eq: 'draft' },
          },
        },
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.elements.notes?.visible).toEqual({
      $state: '/form/tone',
      eq: 'draft',
    })
  })

  it('rejects specs with missing child references', () => {
    const result = validateDocAgentInteractivePageSpec({
      ...validSpec,
      elements: {
        ...validSpec.elements,
        page: {
          ...validSpec.elements.page,
          children: ['section', 'missing-node'],
        },
      },
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.toLowerCase()).toContain('missing')
  })

  it('parses page interaction responses', () => {
    const parsed = parseDocAgentInteractivePageResponse({
      action: 'submit',
      values: {
        form: { tone: 'reference', notes: 'Keep it concise.' },
      },
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.action).toBe('submit')
    expect(parsed.data.values).toEqual({
      form: { tone: 'reference', notes: 'Keep it concise.' },
    })
  })

  it('rejects invalid page interaction responses', () => {
    const parsed = parseDocAgentInteractivePageResponse({
      action: '',
      values: [],
    })

    expect(parsed.success).toBe(false)
  })

  it('builds approval template pages', () => {
    const parsed = parseDocAgentInteractivePageTemplateInput({
      template: 'approval',
      message: 'Review the proposed release notes.',
      summary: 'The agent wants sign-off before publishing this draft.',
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const built = buildDocAgentInteractivePageTemplate(parsed.data)
    const validation = validateDocAgentInteractivePageSpec(built.spec)
    expect(validation.success).toBe(true)
    expect(built.message).toBe('Review the proposed release notes.')
  })

  it('builds brief template pages with structured fields', () => {
    const parsed = parseDocAgentInteractivePageTemplateInput({
      template: 'brief',
      message: 'Collect the missing context.',
      fields: [
        {
          type: 'text',
          name: 'audience',
          label: 'Audience',
          required: true,
        },
        {
          type: 'choice',
          name: 'tone',
          label: 'Tone',
          options: [
            { label: 'Reference', value: 'reference' },
            { label: 'Persuasive', value: 'persuasive' },
          ],
          defaultValue: 'reference',
        },
      ],
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const built = buildDocAgentInteractivePageTemplate(parsed.data)
    const validation = validateDocAgentInteractivePageSpec(built.spec)
    expect(validation.success).toBe(true)
  })

  it('reconstructs template previews from tool calls', () => {
    const preview = getDocAgentInteractivePagePreviewFromToolCall('ask_page_template', {
      template: 'bulk_confirm',
      message: 'Confirm the selected documents.',
      items: [
        { label: 'Getting Started' },
        { label: 'Authentication', description: 'Update examples and scopes' },
      ],
      danger: true,
    })

    expect(preview).not.toBeNull()
    expect(preview?.message).toBe('Confirm the selected documents.')
  })

  it('documents the interactive page tool in prompts', () => {
    expect(buildDocAgentInteractivePagePrompt()).toContain('respond')
    expect(buildDocAgentInteractivePagePrompt()).toContain('visible')
    expect(buildDocAgentInteractivePagePrompt()).toContain('validate')
    expect(buildDocAgentInteractivePageTemplatePrompt()).toContain('approval')
    expect(buildDocAgentInteractivePageTemplatePrompt()).toContain('bulk_confirm')
    expect(buildAgentSystemPrompt()).not.toContain('ask_page_template')
    expect(buildAgentSystemPrompt()).not.toContain('ask_page')
    expect(buildAgentSystemPrompt()).not.toContain('Interactive Page Catalog')
    expect(buildAgentSystemPrompt()).not.toContain('Interactive Page Templates')
  })
})
