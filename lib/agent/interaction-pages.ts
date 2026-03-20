import type { DocAgentInteractivePageSpec } from '@/lib/agent/interactive-page'
import type {
  AgentInteraction,
} from '@/lib/agent/shared'
import type { DocAgentInteractivePageResponse } from '@/components/docs/doc-agent-interactive-page'

function createPageSpec(
  state: Record<string, unknown>,
  elements: DocAgentInteractivePageSpec['elements'],
): DocAgentInteractivePageSpec {
  return {
    state,
    root: 'page',
    elements,
  }
}

function buildConfirmInteractionPage(): DocAgentInteractivePageSpec {
  return createPageSpec(
    {
      form: {
        feedback: '',
      },
    },
    {
      page: {
        type: 'Page',
        props: {
          eyebrow: 'Decision needed',
          title: 'Choose how to proceed',
        },
        children: ['notesSection', 'actions'],
      },
      notesSection: {
        type: 'Section',
        props: {
          title: 'Optional note',
          description: 'Add context or requested changes before the agent resumes.',
        },
        children: ['feedback'],
      },
      feedback: {
        type: 'TextArea',
        props: {
          label: 'Note',
          name: 'feedback',
          value: { $bindState: '/form/feedback' },
          placeholder: 'Anything the agent should keep in mind?',
          rows: 4,
        },
        children: [],
      },
      actions: {
        type: 'ActionRow',
        props: {},
        children: ['approve', 'pause'],
      },
      approve: {
        type: 'ActionButton',
        props: {
          label: 'Approve',
        },
        on: {
          press: {
            action: 'respond',
            params: { action: 'approve' },
          },
        },
        children: [],
      },
      pause: {
        type: 'ActionButton',
        props: {
          label: 'Not now',
          variant: 'secondary',
        },
        on: {
          press: {
            action: 'respond',
            params: { action: 'defer' },
          },
        },
        children: [],
      },
    },
  )
}

function buildSelectInteractionPage(
  interaction: Extract<AgentInteraction, { type: 'select' }>,
): DocAgentInteractivePageSpec {
  return createPageSpec(
    {
      form: {
        selected: '',
      },
    },
    {
      page: {
        type: 'Page',
        props: {
          eyebrow: 'Choose one',
          title: 'Pick the next direction',
        },
        children: ['selectionSection', 'actions'],
      },
      selectionSection: {
        type: 'Section',
        props: {
          title: 'Options',
        },
        children: ['choices'],
      },
      choices: {
        type: 'ChoiceGroup',
        props: {
          label: 'Selection',
          name: 'selected',
          value: { $bindState: '/form/selected' },
          required: true,
          requiredMessage: 'Choose one option before continuing.',
          options: interaction.options.map((option) => ({
            label: option,
            value: option,
          })),
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
          validate: true,
        },
        on: {
          press: {
            action: 'respond',
            params: { action: 'submit' },
          },
        },
        children: [],
      },
    },
  )
}

function buildInputInteractionPage(
  interaction: Extract<AgentInteraction, { type: 'input' }>,
): DocAgentInteractivePageSpec {
  return createPageSpec(
    {
      form: {
        text: '',
      },
    },
    {
      page: {
        type: 'Page',
        props: {
          eyebrow: 'Quick reply',
          title: 'Reply to the agent',
        },
        children: ['responseSection', 'actions'],
      },
      responseSection: {
        type: 'Section',
        props: {
          title: 'Your response',
          description: 'Give the agent enough detail to continue without guessing.',
        },
        children: ['text'],
      },
      text: {
        type: 'TextArea',
        props: {
          label: 'Reply',
          name: 'text',
          value: { $bindState: '/form/text' },
          placeholder: interaction.placeholder ?? 'Type your response...',
          required: true,
          requiredMessage: 'Enter a response before continuing.',
          rows: 4,
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
          label: 'Send reply',
          validate: true,
        },
        on: {
          press: {
            action: 'respond',
            params: { action: 'submit' },
          },
        },
        children: [],
      },
    },
  )
}

export function buildDocAgentInteractionPage(
  interaction: AgentInteraction,
): { message: string; spec: DocAgentInteractivePageSpec } {
  switch (interaction.type) {
    case 'page':
      return {
        message: interaction.message,
        spec: interaction.spec,
      }
    case 'confirm':
      return {
        message: interaction.message,
        spec: buildConfirmInteractionPage(),
      }
    case 'select':
      return {
        message: interaction.message,
        spec: buildSelectInteractionPage(interaction),
      }
    case 'input':
      return {
        message: interaction.message,
        spec: buildInputInteractionPage(interaction),
      }
  }
}

export function mapInteractionPageResponseToBody(
  interaction: AgentInteraction,
  response: DocAgentInteractivePageResponse,
): Record<string, unknown> {
  if (interaction.type === 'page') {
    return response
  }

  const values = response.values as {
    form?: Record<string, unknown>
  }

  if (interaction.type === 'confirm') {
    const feedback = typeof values.form?.feedback === 'string'
      ? values.form.feedback.trim()
      : ''
    return {
      accepted: response.action === 'approve',
      ...(feedback ? { feedback } : {}),
    }
  }

  if (interaction.type === 'select') {
    return {
      selected:
        typeof values.form?.selected === 'string'
          ? values.form.selected
          : '',
    }
  }

  return {
    text:
      typeof values.form?.text === 'string'
        ? values.form.text.trim()
        : '',
  }
}
