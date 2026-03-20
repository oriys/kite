import type { Spec } from '@json-render/core'
import { z } from 'zod'
import { validateDocAgentInteractivePageSpec } from '@/lib/agent/interactive-page'

type DocAgentInteractivePageElement = Spec['elements'][string]
type DocAgentInteractivePageEntry = readonly [string, DocAgentInteractivePageElement]

const optionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(80),
  description: z.string().trim().max(160).optional(),
})

const baseTemplateSchema = {
  message: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .describe('Short context shown above the page'),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(240).optional(),
}

const approvalTemplateSchema = z.object({
  template: z.literal('approval'),
  ...baseTemplateSchema,
  summary: z.string().trim().max(320).optional(),
  warning: z.string().trim().max(240).optional(),
  notesLabel: z.string().trim().max(80).optional(),
  notesPlaceholder: z.string().trim().max(180).optional(),
})

const revisionStrategyTemplateSchema = z
  .object({
    template: z.literal('revision_strategy'),
    ...baseTemplateSchema,
    options: z
      .array(optionSchema)
      .min(2)
      .max(6)
      .describe('Strategy options to show in the picker'),
    defaultValue: z.string().trim().min(1).max(80).optional(),
    summary: z.string().trim().max(320).optional(),
    notesLabel: z.string().trim().max(80).optional(),
    notesPlaceholder: z.string().trim().max(180).optional(),
    submitLabel: z.string().trim().max(80).optional(),
    skipLabel: z.string().trim().max(80).optional(),
  })
  .refine(
    (value) =>
      value.defaultValue === undefined
      || value.options.some((option) => option.value === value.defaultValue),
    {
      message: 'defaultValue must match one of the provided options',
      path: ['defaultValue'],
    },
  )

const briefFieldBaseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().trim().max(180).optional(),
  helpText: z.string().trim().max(200).optional(),
  required: z.boolean().optional(),
})

const briefTextFieldSchema = briefFieldBaseSchema.extend({
  type: z.literal('text'),
  defaultValue: z.string().max(240).optional(),
  minLength: z.number().int().min(1).max(160).optional(),
  maxLength: z.number().int().min(1).max(240).optional(),
  pattern: z.string().trim().min(1).max(200).optional(),
  patternMessage: z.string().trim().max(160).optional(),
})

const briefTextareaFieldSchema = briefFieldBaseSchema.extend({
  type: z.literal('textarea'),
  defaultValue: z.string().max(4000).optional(),
  minLength: z.number().int().min(1).max(800).optional(),
  maxLength: z.number().int().min(1).max(4000).optional(),
  rows: z.number().int().min(3).max(8).optional(),
})

const briefSelectFieldSchema = briefFieldBaseSchema.extend({
  type: z.literal('select'),
  defaultValue: z.string().trim().min(1).max(80).optional(),
  options: z.array(optionSchema).min(2).max(8),
})

const briefChoiceFieldSchema = briefFieldBaseSchema.extend({
  type: z.literal('choice'),
  defaultValue: z.string().trim().min(1).max(80).optional(),
  options: z.array(optionSchema).min(2).max(6),
})

const briefFieldSchema = z.discriminatedUnion('type', [
  briefTextFieldSchema,
  briefTextareaFieldSchema,
  briefSelectFieldSchema,
  briefChoiceFieldSchema,
])

const briefTemplateSchema = z
  .object({
    template: z.literal('brief'),
    ...baseTemplateSchema,
    fields: z
      .array(briefFieldSchema)
      .min(1)
      .max(6)
      .describe('1-6 structured fields to collect from the user'),
    guidance: z.string().trim().max(320).optional(),
    submitLabel: z.string().trim().max(80).optional(),
  })
  .superRefine((value, ctx) => {
    const names = new Set<string>()
    value.fields.forEach((field, index) => {
      if (names.has(field.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Field names must be unique',
          path: ['fields', index, 'name'],
        })
      }
      names.add(field.name)

      if (
        'options' in field
        && field.defaultValue
        && !field.options.some((option) => option.value === field.defaultValue)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'defaultValue must match one of the provided options',
          path: ['fields', index, 'defaultValue'],
        })
      }
    })
  })

const bulkConfirmItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(200).optional(),
})

const bulkConfirmTemplateSchema = z.object({
  template: z.literal('bulk_confirm'),
  ...baseTemplateSchema,
  items: z
    .array(bulkConfirmItemSchema)
    .min(1)
    .max(8)
    .describe('Items the user should review before confirming'),
  warning: z.string().trim().max(240).optional(),
  danger: z.boolean().optional(),
  notesLabel: z.string().trim().max(80).optional(),
  notesPlaceholder: z.string().trim().max(180).optional(),
  confirmLabel: z.string().trim().max(80).optional(),
  cancelLabel: z.string().trim().max(80).optional(),
})

export const docAgentInteractivePageTemplateInputSchema = z.discriminatedUnion('template', [
  approvalTemplateSchema,
  revisionStrategyTemplateSchema,
  briefTemplateSchema,
  bulkConfirmTemplateSchema,
])

export type DocAgentInteractivePageTemplateInput = z.infer<
  typeof docAgentInteractivePageTemplateInputSchema
>

function createActionButton(
  key: string,
  props: Record<string, unknown>,
  action: string,
  extra?: Record<string, unknown>,
) : DocAgentInteractivePageEntry {
  return [
    key,
    {
      type: 'ActionButton',
      props,
      on: {
        press: {
          action: 'respond',
          params: { action },
          ...(extra ?? {}),
        },
      },
      children: [],
    },
  ] as const
}

function addOptionalCallout(
  entries: DocAgentInteractivePageEntry[],
  pageChildren: string[],
  key: string,
  title: string,
  message?: string,
  tone: 'info' | 'warning' | 'success' = 'info',
) {
  if (!message) return

  entries.push([
    key,
    {
      type: 'Callout',
      props: { title, message, tone },
      children: [],
    },
  ])
  pageChildren.push(key)
}

function createSpec(
  state: Record<string, unknown>,
  page: DocAgentInteractivePageElement,
  elements: DocAgentInteractivePageEntry[],
): Spec {
  return {
    state,
    root: 'page',
    elements: Object.fromEntries([['page', page], ...elements]) as Spec['elements'],
  }
}

function buildApprovalTemplate(input: z.infer<typeof approvalTemplateSchema>) {
  const pageChildren: string[] = []
  const elements: DocAgentInteractivePageEntry[] = []

  addOptionalCallout(elements, pageChildren, 'summary', 'What the agent is asking', input.summary)
  addOptionalCallout(
    elements,
    pageChildren,
    'warning',
    'Review carefully',
    input.warning,
    'warning',
  )

  elements.push([
    'notesSection',
    {
      type: 'Section',
      props: {
        title: 'Optional notes',
        description: 'Add context, requested changes, or blockers before the agent continues.',
      },
      children: ['notes'],
    },
  ])
  pageChildren.push('notesSection')

  elements.push([
    'notes',
    {
      type: 'TextArea',
      props: {
        label: input.notesLabel ?? 'Notes for the agent',
        name: 'notes',
        value: { $bindState: '/form/notes' },
        placeholder:
          input.notesPlaceholder ?? 'Anything the agent should keep in mind?',
        helpText: 'Leave this blank if a button choice is enough.',
        rows: 4,
      },
      children: [],
    },
  ])

  elements.push([
    'actions',
    {
      type: 'ActionRow',
      props: {},
      children: ['hold', 'requestChanges', 'approve'],
    },
  ])
  pageChildren.push('actions')

  elements.push(
    createActionButton(
      'hold',
      {
        label: 'Hold for now',
        hint: 'Pause and leave the current plan untouched.',
        variant: 'ghost',
      },
      'hold',
    ),
    createActionButton(
      'requestChanges',
      {
        label: 'Request changes',
        hint: 'Send the agent back with revision notes.',
        variant: 'secondary',
      },
      'request_changes',
    ),
    createActionButton(
      'approve',
      {
        label: 'Approve as-is',
        hint: 'Continue without another revision pass.',
      },
      'approve',
    ),
  )

  const spec = createSpec(
    { form: { notes: '' } },
    {
      type: 'Page',
      props: {
        eyebrow: 'Approval',
        title: input.title ?? 'Choose the next step',
        description:
          input.description
          ?? 'Pick the outcome that best matches what should happen next.',
      },
      children: pageChildren,
    },
    elements,
  )

  return { message: input.message, spec }
}

function buildRevisionStrategyTemplate(
  input: z.infer<typeof revisionStrategyTemplateSchema>,
) {
  const pageChildren = ['strategySection', 'actions']
  const elements: DocAgentInteractivePageEntry[] = []

  addOptionalCallout(
    elements,
    pageChildren,
    'summary',
    'Current revision context',
    input.summary,
  )

  elements.push([
    'strategySection',
    {
      type: 'Section',
      props: {
        title: 'Preferred revision path',
        description: 'Choose one direction so the agent can continue decisively.',
      },
      children: ['strategy', 'notes'],
    },
  ])

  elements.push([
    'strategy',
    {
      type: 'ChoiceGroup',
      props: {
        label: 'Revision strategy',
        name: 'strategy',
        value: { $bindState: '/form/strategy' },
        options: input.options,
        required: true,
        requiredMessage: 'Choose the strategy you want the agent to follow.',
        helpText: 'Pick the single path the agent should execute next.',
      },
      children: [],
    },
  ])

  elements.push([
    'notes',
    {
      type: 'TextArea',
      props: {
        label: input.notesLabel ?? 'Extra guidance',
        name: 'notes',
        value: { $bindState: '/form/notes' },
        placeholder:
          input.notesPlaceholder ?? 'Any constraints or priorities to keep intact?',
        helpText: 'Optional, but useful when you want the agent to preserve or avoid something specific.',
        rows: 4,
      },
      children: [],
    },
  ])

  elements.push([
    'actions',
    {
      type: 'ActionRow',
      props: {},
      children: ['skip', 'apply'],
    },
  ])

  elements.push(
    createActionButton(
      'skip',
      {
        label: input.skipLabel ?? 'Keep current plan',
        hint: 'Resume without changing the current direction.',
        variant: 'ghost',
      },
      'keep_current_plan',
    ),
    createActionButton(
      'apply',
      {
        label: input.submitLabel ?? 'Apply selected strategy',
        hint: 'Continue with the choice above.',
        validate: true,
      },
      'apply_strategy',
    ),
  )

  const spec = createSpec(
    {
      form: {
        strategy: input.defaultValue ?? '',
        notes: '',
      },
    },
    {
      type: 'Page',
      props: {
        eyebrow: 'Revision strategy',
        title: input.title ?? 'How should the agent revise this?',
        description:
          input.description
          ?? 'Choose the revision path, then add any extra guidance the agent should follow.',
      },
      children: pageChildren,
    },
    elements,
  )

  return { message: input.message, spec }
}

function buildBriefFieldElement(field: z.infer<typeof briefFieldSchema>) {
  switch (field.type) {
    case 'text':
      return {
        type: 'TextInput',
        props: {
          label: field.label,
          name: field.name,
          value: { $bindState: `/form/${field.name}` },
          placeholder: field.placeholder,
          helpText: field.helpText,
          required: field.required,
          minLength: field.minLength,
          maxLength: field.maxLength,
          pattern: field.pattern,
          patternMessage: field.patternMessage,
        },
        children: [],
      }
    case 'textarea':
      return {
        type: 'TextArea',
        props: {
          label: field.label,
          name: field.name,
          value: { $bindState: `/form/${field.name}` },
          placeholder: field.placeholder,
          helpText: field.helpText,
          required: field.required,
          minLength: field.minLength,
          maxLength: field.maxLength,
          rows: field.rows,
        },
        children: [],
      }
    case 'select':
      return {
        type: 'SelectInput',
        props: {
          label: field.label,
          name: field.name,
          value: { $bindState: `/form/${field.name}` },
          placeholder: field.placeholder,
          helpText: field.helpText,
          required: field.required,
          options: field.options,
        },
        children: [],
      }
    case 'choice':
      return {
        type: 'ChoiceGroup',
        props: {
          label: field.label,
          name: field.name,
          value: { $bindState: `/form/${field.name}` },
          helpText: field.helpText,
          required: field.required,
          options: field.options,
        },
        children: [],
      }
  }
}

function buildBriefTemplate(input: z.infer<typeof briefTemplateSchema>) {
  const fieldKeys = input.fields.map((field) => `field-${field.name}`)
  const initialFormState = Object.fromEntries(
    input.fields.map((field) => {
      const value =
        'defaultValue' in field && field.defaultValue !== undefined
          ? field.defaultValue
          : ''
      return [field.name, value]
    }),
  )

  const pageChildren = ['briefSection', 'actions']
  const elements: DocAgentInteractivePageEntry[] = []

  addOptionalCallout(elements, pageChildren, 'guidance', 'Helpful context', input.guidance)

  elements.push([
    'briefSection',
    {
      type: 'Section',
      props: {
        title: 'What should the agent work from?',
        description:
          'Fill in the details below so the agent can continue with fewer follow-up questions.',
      },
      children: fieldKeys,
    },
  ])

  input.fields.forEach((field) => {
    elements.push([`field-${field.name}`, buildBriefFieldElement(field)])
  })

  elements.push([
    'actions',
    {
      type: 'ActionRow',
      props: {},
      children: ['submit'],
    },
  ])

  elements.push(
    createActionButton(
      'submit',
      {
        label: input.submitLabel ?? 'Continue with this brief',
        hint: 'Send these answers back to the agent.',
        validate: true,
      },
      'submit',
    ),
  )

  const spec = createSpec(
    { form: initialFormState },
    {
      type: 'Page',
      props: {
        eyebrow: 'Project brief',
        title: input.title ?? 'Fill in the missing details',
        description:
          input.description
          ?? 'Give the agent the information it needs in one pass.',
      },
      children: pageChildren,
    },
    elements,
  )

  return { message: input.message, spec }
}

function buildBulkConfirmTemplate(input: z.infer<typeof bulkConfirmTemplateSchema>) {
  const itemKeys = input.items.map((_, index) => `item-${index + 1}`)
  const pageChildren = ['itemsSection', 'notesSection', 'actions']
  const elements: DocAgentInteractivePageEntry[] = []

  addOptionalCallout(
    elements,
    pageChildren,
    'warning',
    input.danger ? 'This action is hard to undo' : 'Review before continuing',
    input.warning
      ?? (input.danger
        ? 'Double-check the list below before confirming.'
        : undefined),
    input.danger ? 'warning' : 'info',
  )

  elements.push([
    'itemsSection',
    {
      type: 'Section',
      props: {
        title: `Included items (${input.items.length})`,
        description: 'Everything listed here will be included in the next step.',
      },
      children: itemKeys,
    },
  ])

  input.items.forEach((item, index) => {
    elements.push([
      `item-${index + 1}`,
      {
        type: 'Text',
        props: {
          text: `• ${item.label}${item.description ? ` — ${item.description}` : ''}`,
        },
        children: [],
      },
    ])
  })

  elements.push([
    'notesSection',
    {
      type: 'Section',
      props: {
        title: 'Optional notes',
        description: 'Add any final instructions the agent should carry forward.',
      },
      children: ['notes'],
    },
  ])

  elements.push([
    'notes',
    {
      type: 'TextArea',
      props: {
        label: input.notesLabel ?? 'Notes for the agent',
        name: 'notes',
        value: { $bindState: '/form/notes' },
        placeholder:
          input.notesPlaceholder ?? 'Anything the agent should keep in mind?',
        helpText: 'Optional.',
        rows: 4,
      },
      children: [],
    },
  ])

  elements.push([
    'actions',
    {
      type: 'ActionRow',
      props: {},
      children: ['cancel', 'confirm'],
    },
  ])

  elements.push(
    createActionButton(
      'cancel',
      {
        label: input.cancelLabel ?? 'Keep editing',
        hint: 'Return without confirming this batch.',
        variant: 'ghost',
      },
      'keep_editing',
    ),
    createActionButton(
      'confirm',
      {
        label: input.confirmLabel ?? 'Confirm and continue',
        hint: input.danger ? 'You will be asked to confirm one more time.' : 'Continue with the items above.',
      },
      'confirm',
      input.danger
        ? {
            confirm: {
              title: 'Confirm this batch',
              message:
                'This will continue with all of the listed items. Make sure everything above looks right.',
              confirmLabel: input.confirmLabel ?? 'Confirm and continue',
              cancelLabel: input.cancelLabel ?? 'Keep editing',
              variant: 'danger',
            },
          }
        : undefined,
    ),
  )

  const spec = createSpec(
    { form: { notes: '' } },
    {
      type: 'Page',
      props: {
        eyebrow: 'Bulk confirmation',
        title: input.title ?? 'Confirm this batch',
        description:
          input.description
          ?? 'Review the list below, then decide whether the agent should proceed.',
      },
      children: pageChildren,
    },
    elements,
  )

  return { message: input.message, spec }
}

export function parseDocAgentInteractivePageTemplateInput(input: unknown) {
  return docAgentInteractivePageTemplateInputSchema.safeParse(input)
}

export function buildDocAgentInteractivePageTemplate(
  input: DocAgentInteractivePageTemplateInput,
) {
  switch (input.template) {
    case 'approval':
      return buildApprovalTemplate(input)
    case 'revision_strategy':
      return buildRevisionStrategyTemplate(input)
    case 'brief':
      return buildBriefTemplate(input)
    case 'bulk_confirm':
      return buildBulkConfirmTemplate(input)
  }
}

export function buildDocAgentInteractivePageTemplatePrompt() {
  return [
    'Prefer ask_page_template over raw ask_page when one of these built-in templates fits:',
    '- approval: approve, request changes, or hold, with optional notes.',
    '- revision_strategy: choose one revision path from provided options, optionally add guidance, then continue.',
    '- brief: collect 1-6 structured fields (text, textarea, select, or choice) in one compact form.',
    '- bulk_confirm: review a batch list, optionally add notes, then confirm or keep editing.',
    'Use raw ask_page only when you truly need a custom layout that the templates cannot express.',
  ].join('\n')
}

export function getDocAgentInteractivePagePreviewFromToolCall(
  toolName: string,
  args: Record<string, unknown>,
) {
  if (toolName === 'ask_page') {
    const message = typeof args.message === 'string' ? args.message : undefined
    const validation = validateDocAgentInteractivePageSpec(args.spec)
    return validation.success ? { message, spec: validation.data } : null
  }

  if (toolName === 'ask_page_template') {
    const parsed = parseDocAgentInteractivePageTemplateInput(args)
    if (!parsed.success) return null

    const built = buildDocAgentInteractivePageTemplate(parsed.data)
    const validation = validateDocAgentInteractivePageSpec(built.spec)
    return validation.success
      ? { message: built.message, spec: validation.data }
      : null
  }

  return null
}
