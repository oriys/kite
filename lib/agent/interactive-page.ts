import {
  autoFixSpec,
  defineCatalog,
  formatSpecIssues,
  validateSpec,
  type Spec,
} from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

const optionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(80),
  description: z.string().trim().max(160).optional(),
})

const toneSchema = z.enum(['default', 'muted'])
const calloutToneSchema = z.enum(['info', 'warning', 'success'])
const buttonVariantSchema = z.enum(['primary', 'secondary', 'ghost'])
const requiredMessageSchema = z.string().trim().max(160).optional()
const patternSchema = z.string().trim().min(1).max(200).optional()

const textInputPropsSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(80),
    value: z.string().optional().nullable(),
    placeholder: z.string().trim().max(120).optional(),
    helpText: z.string().trim().max(200).optional(),
    required: z.boolean().optional(),
    requiredMessage: requiredMessageSchema,
    minLength: z.number().int().min(1).max(160).optional(),
    maxLength: z.number().int().min(1).max(240).optional(),
    pattern: patternSchema,
    patternMessage: z.string().trim().max(160).optional(),
  })
  .refine(
    (value) =>
      value.minLength === undefined
      || value.maxLength === undefined
      || value.maxLength >= value.minLength,
    {
      message: 'maxLength must be greater than or equal to minLength',
      path: ['maxLength'],
    },
  )

const textAreaPropsSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(80),
    value: z.string().optional().nullable(),
    placeholder: z.string().trim().max(180).optional(),
    helpText: z.string().trim().max(240).optional(),
    rows: z.number().int().min(3).max(12).optional(),
    required: z.boolean().optional(),
    requiredMessage: requiredMessageSchema,
    minLength: z.number().int().min(1).max(800).optional(),
    maxLength: z.number().int().min(1).max(4000).optional(),
  })
  .refine(
    (value) =>
      value.minLength === undefined
      || value.maxLength === undefined
      || value.maxLength >= value.minLength,
    {
      message: 'maxLength must be greater than or equal to minLength',
      path: ['maxLength'],
    },
  )

export const docAgentInteractivePageCatalog = defineCatalog(schema, {
  components: {
    Page: {
      description:
        'Root container for a compact interaction page. Use exactly once as the root element.',
      props: z.object({
        eyebrow: z.string().trim().max(48).optional(),
        title: z.string().trim().max(120).optional(),
        description: z.string().trim().max(400).optional(),
      }),
      slots: ['children'],
    },
    Section: {
      description: 'Grouped content area with an optional heading and helper copy.',
      props: z.object({
        title: z.string().trim().max(120).optional(),
        description: z.string().trim().max(240).optional(),
      }),
      slots: ['children'],
    },
    Text: {
      description: 'Short supporting paragraph or note.',
      props: z.object({
        text: z.string().trim().min(1).max(1000),
        tone: toneSchema.optional(),
      }),
    },
    Callout: {
      description: 'Highlighted status note or warning.',
      props: z.object({
        title: z.string().trim().min(1).max(120),
        message: z.string().trim().max(400).optional(),
        tone: calloutToneSchema.optional(),
      }),
    },
    TextInput: {
      description:
        'Single-line text input. Bind `value` with $bindState when the agent needs the result. Use required/minLength/maxLength/pattern when the user must provide a well-formed answer.',
      props: textInputPropsSchema,
    },
    TextArea: {
      description:
        'Multi-line input for richer feedback. Bind `value` with $bindState when the agent needs the result. Use required/minLength/maxLength to keep responses actionable.',
      props: textAreaPropsSchema,
    },
    SelectInput: {
      description:
        'Dropdown selection input. Bind `value` with $bindState when the agent needs the chosen option. Set required when the user must pick one before continuing.',
      props: z.object({
        label: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(80),
        value: z.string().optional().nullable(),
        placeholder: z.string().trim().max(120).optional(),
        helpText: z.string().trim().max(200).optional(),
        options: z.array(optionSchema).min(2).max(12),
        required: z.boolean().optional(),
        requiredMessage: requiredMessageSchema,
      }),
    },
    ChoiceGroup: {
      description:
        'Compact option picker rendered as selectable cards. Bind `value` with $bindState when the agent needs the chosen option. Set required when the user must choose one before continuing.',
      props: z.object({
        label: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(80),
        value: z.string().optional().nullable(),
        helpText: z.string().trim().max(200).optional(),
        options: z.array(optionSchema).min(2).max(8),
        required: z.boolean().optional(),
        requiredMessage: requiredMessageSchema,
      }),
    },
    ActionRow: {
      description: 'Horizontal row of action buttons.',
      props: z.object({}),
      slots: ['children'],
    },
    ActionButton: {
      description:
        'Action button. Bind `on.press` to the `respond` action with params.action set to a short machine-friendly action name. Set validate=true on the primary continue button when required fields should block submission. Add confirm metadata to on.press for risky actions.',
      props: z.object({
        label: z.string().trim().min(1).max(80),
        hint: z.string().trim().max(120).optional(),
        variant: buttonVariantSchema.optional(),
        validate: z.boolean().optional(),
      }),
      events: ['press'],
    },
  },
  actions: {
    respond: {
      description:
        'Submit the current page state back to the Doc Agent. Use params.action for a short machine-friendly result such as submit, approve, revise, or skip.',
      params: z.object({
        action: z.string().trim().min(1).max(80),
      }),
    },
  },
})

export type DocAgentInteractivePageSpec = Spec

export const docAgentInteractivePageResponseSchema = z.object({
  action: z.string().trim().min(1).max(80),
  values: z.record(z.string(), z.unknown()).optional().default({}),
})

export type DocAgentInteractivePageResponseBody = z.infer<
  typeof docAgentInteractivePageResponseSchema
>

export function parseDocAgentInteractivePageResponse(input: unknown) {
  return docAgentInteractivePageResponseSchema.safeParse(input)
}

function formatValidationIssues(issues: z.ZodIssue[]) {
  return issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'spec'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

function maybeAutoFixInteractivePageSpec(spec: unknown): unknown {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return spec
  }

  const candidate = spec as Partial<Spec> & { elements?: unknown }
  if (typeof candidate.root !== 'string') {
    return spec
  }

  if (!candidate.elements || typeof candidate.elements !== 'object' || Array.isArray(candidate.elements)) {
    return spec
  }

  return autoFixSpec(candidate as Spec).spec
}

export function validateDocAgentInteractivePageSpec(spec: unknown):
  | { success: true; data: DocAgentInteractivePageSpec }
  | { success: false; error: string } {
  const fixedSpec = maybeAutoFixInteractivePageSpec(spec)
  const result = docAgentInteractivePageCatalog.validate(fixedSpec)
  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error
        ? formatValidationIssues(result.error.issues)
        : 'Invalid interactive page spec.',
      }
  }

  const validatedSpec = result.data as Spec
  const structuralValidation = validateSpec(validatedSpec)
  if (!structuralValidation.valid) {
    return {
      success: false,
      error: formatSpecIssues(structuralValidation.issues),
    }
  }

  const elementCount = Object.keys(validatedSpec.elements ?? {}).length
  if (elementCount === 0) {
    return { success: false, error: 'Interactive page must include at least one element.' }
  }

  if (elementCount > 40) {
    return { success: false, error: 'Interactive page is too large. Keep it under 40 elements.' }
  }

  return { success: true, data: validatedSpec }
}

export function buildDocAgentInteractivePagePrompt() {
  return docAgentInteractivePageCatalog.prompt({
    customRules: [
      'Use exactly one Page root element.',
      'Keep the page compact: prefer 1-2 sections, 1-4 inputs, and 1-3 action buttons.',
      'Bind every field you need returned with $bindState under /form/... so the agent receives structured values.',
      'Use the element-level visible field (not props.visible) for progressive disclosure, such as showing follow-up questions only after a specific option is chosen.',
      'When the user must provide a valid answer before continuing, add field props such as required, minLength, maxLength, or pattern and set the primary ActionButton validate prop to true.',
      'Any button that should resume the agent must use on.press -> respond with params.action set to a short snake_case or kebab-case action name.',
      'For risky or irreversible actions, add on.press.confirm with a short title, a concise message, and confirm/cancel labels instead of creating a separate confirmation step.',
    ],
  })
}
