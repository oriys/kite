import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DocAgentInteractionWidget } from '@/components/docs/doc-agent-interaction-widget'
import type { DocAgentInteractivePageSpec } from '@/lib/agent/interactive-page'

const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
})

const pageSpec: DocAgentInteractivePageSpec = {
  state: {
    form: {
      notes: '',
    },
  },
  root: 'page',
  elements: {
    page: {
      type: 'Page',
      props: {
        title: 'Reply',
      },
      children: ['notes', 'actions'],
    },
    notes: {
      type: 'TextArea',
      props: {
        label: 'Notes',
        name: 'notes',
        value: { $bindState: '/form/notes' },
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

function changeTextarea(textarea: HTMLTextAreaElement, value: string) {
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )
    descriptor?.set?.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('DocAgentInteractionWidget', () => {
  it('submits plain text for ask_input interactions', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const onRespond = vi.fn().mockResolvedValue(undefined)

    act(() => {
      root.render(
        <DocAgentInteractionWidget
          interaction={{
            id: 'input_1',
            toolName: 'ask_input',
            type: 'input',
            message: 'Add context.',
            placeholder: 'Type your response...',
          }}
          onRespond={onRespond}
        />,
      )
    })

    const textarea = container.querySelector('textarea')
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Send reply'),
    )

    expect(textarea).not.toBeNull()
    expect(button).not.toBeNull()
    if (!textarea || !button) return

    changeTextarea(textarea, 'Focus on onboarding.')
    expect(button).not.toBeDisabled()

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(onRespond).toHaveBeenCalledWith({ text: 'Focus on onboarding.' })

    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('falls back to plain text submission for legacy page interactions', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const onRespond = vi.fn().mockResolvedValue(undefined)

    act(() => {
      root.render(
        <DocAgentInteractionWidget
          interaction={{
            id: 'page_1',
            toolName: 'ask_page_template',
            type: 'page',
            message: 'Share the missing context.',
            spec: pageSpec,
          }}
          onRespond={onRespond}
        />,
      )
    })

    const textarea = container.querySelector('textarea')
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Send reply'),
    )

    expect(textarea).not.toBeNull()
    expect(button).not.toBeNull()
    if (!textarea || !button) return

    changeTextarea(textarea, 'Target readers are new workspace admins.')
    expect(button).not.toBeDisabled()

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(onRespond).toHaveBeenCalledWith({
      action: 'submit',
      values: {
        response: 'Target readers are new workspace admins.',
      },
    })

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
