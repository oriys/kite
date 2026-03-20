'use client'

import * as React from 'react'
import { check, type InferComponentProps, type ValidationConfig } from '@json-render/core'
import {
  createRenderer,
  useFieldValidation,
  useOptionalValidation,
  useBoundProp,
  type ComponentRenderProps,
} from '@json-render/react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  docAgentInteractivePageCatalog,
  validateDocAgentInteractivePageSpec,
} from '@/lib/agent/interactive-page'
import { cn } from '@/lib/utils'

type PageProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'Page'>
type SectionProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'Section'>
type TextProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'Text'>
type CalloutProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'Callout'>
type TextInputProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'TextInput'>
type TextAreaProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'TextArea'>
type SelectInputProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'SelectInput'>
type ChoiceGroupProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'ChoiceGroup'>
type ActionRowProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'ActionRow'>
type ActionButtonProps = InferComponentProps<typeof docAgentInteractivePageCatalog, 'ActionButton'>

const InteractiveModeContext = React.createContext({ interactive: true, busy: false })
const surfaceTransitionClass =
  'transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none'
const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

function useInteractiveMode() {
  return React.useContext(InteractiveModeContext)
}

function scheduleValidation(validate: () => void) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(validate)
    return
  }

  void Promise.resolve().then(validate)
}

function cloneState<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeState(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return cloneState(value as Record<string, unknown>)
}

function getInitialStateFromSpec(spec: unknown) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return {}
  }

  const rawState = 'state' in spec ? (spec as { state?: unknown }).state : undefined
  return normalizeState(rawState)
}

function setValueAtPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return

  let cursor: Record<string, unknown> = target
  for (const segment of segments.slice(0, -1)) {
    const nextValue = cursor[segment]
    if (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue)) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  }

  cursor[segments[segments.length - 1]!] = value
}

function applyStateChanges(
  current: Record<string, unknown>,
  changes: Array<{ path: string; value: unknown }>,
) {
  const next = cloneState(current)
  for (const change of changes) {
    setValueAtPath(next, change.path, change.value)
  }
  return next
}

function FieldLabel({
  label,
  required,
}: {
  label: string
  required?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {required ? (
        <span className="text-[10px] font-medium tracking-[0.16em] text-destructive uppercase">
          Required
        </span>
      ) : null}
    </div>
  )
}

function FieldSupportText({
  helpText,
  errors,
  counter,
}: {
  helpText?: string
  errors?: string[]
  counter?: string
}) {
  if ((!helpText && !counter) && (!errors || errors.length === 0)) {
    return null
  }

  const hasErrors = Boolean(errors && errors.length > 0)

  return (
    <div className="flex items-start justify-between gap-3">
      <div
        role={hasErrors ? 'alert' : undefined}
        className={cn(
          'min-w-0 text-[11px] leading-5',
          hasErrors ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {hasErrors ? (
          <ul className="space-y-0.5">
            {errors?.map((error) => <li key={error}>{error}</li>)}
          </ul>
        ) : (
          helpText
        )}
      </div>
      {counter ? (
        <span
          className={cn(
            'shrink-0 font-mono text-[10px]',
            hasErrors ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {counter}
        </span>
      ) : null}
    </div>
  )
}

function buildTextValidationConfig(props: {
  label: string
  required?: boolean
  requiredMessage?: string
  minLength?: number
  maxLength?: number
  pattern?: string
  patternMessage?: string
}): ValidationConfig | undefined {
  const checks = []

  if (props.required) {
    checks.push(check.required(props.requiredMessage ?? `${props.label} is required.`))
  }

  if (typeof props.minLength === 'number') {
    checks.push(
      check.minLength(
        props.minLength,
        `${props.label} must be at least ${props.minLength} characters.`,
      ),
    )
  }

  if (typeof props.maxLength === 'number') {
    checks.push(
      check.maxLength(
        props.maxLength,
        `${props.label} must be ${props.maxLength} characters or fewer.`,
      ),
    )
  }

  if (props.pattern) {
    checks.push(
      check.pattern(
        props.pattern,
        props.patternMessage ?? `Enter a valid ${props.label.toLowerCase()}.`,
      ),
    )
  }

  return checks.length > 0 ? { checks, validateOn: 'blur' } : undefined
}

function buildChoiceValidationConfig(props: {
  label: string
  required?: boolean
  requiredMessage?: string
}): ValidationConfig | undefined {
  if (!props.required) {
    return undefined
  }

  return {
    checks: [check.required(props.requiredMessage ?? `${props.label} is required.`)],
    validateOn: 'change',
  }
}

function PageBlock({
  element,
  children,
}: ComponentRenderProps<PageProps>) {
  const { eyebrow, title, description } = element.props

  return (
    <div className="space-y-5 rounded-[1.4rem] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--background)_92%,var(--primary)_8%),color-mix(in_oklch,var(--background)_98%,var(--muted)_2%))] px-4 py-4 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.28)] sm:px-5">
      {(eyebrow || title || description) && (
        <div className="space-y-2 border-b border-border/50 pb-4">
          {eyebrow ? (
            <p className="inline-flex w-fit items-center rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[10px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              {title}
            </h3>
          ) : null}
          {description ? (
            <p className="max-w-prose text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      )}
      <div className="space-y-3.5">{children}</div>
    </div>
  )
}

function SectionBlock({
  element,
  children,
}: ComponentRenderProps<SectionProps>) {
  const { title, description } = element.props

  return (
    <section className="space-y-3.5 rounded-[1.05rem] border border-border/60 bg-background/88 px-3.5 py-3.5">
      {(title || description) && (
        <div className="space-y-1.5">
          {title ? <h4 className="text-sm font-medium text-foreground">{title}</h4> : null}
          {description ? (
            <p className="text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function TextBlock({
  element,
}: ComponentRenderProps<TextProps>) {
  return (
    <p
      className={cn(
        'max-w-prose text-sm leading-6',
        element.props.tone === 'muted' ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {element.props.text}
    </p>
  )
}

function CalloutBlock({
  element,
}: ComponentRenderProps<CalloutProps>) {
  const tone = element.props.tone ?? 'info'
  const toneClasses: Record<
    typeof tone,
    { root: string; title: string; message: string }
  > = {
    info: {
      root: 'border-primary/20 bg-primary/6',
      title: 'text-foreground',
      message: 'text-primary/80 dark:text-primary/70',
    },
    success: {
      root: 'border-emerald-500/25 bg-emerald-500/8',
      title: 'text-emerald-950 dark:text-emerald-100',
      message: 'text-emerald-800 dark:text-emerald-200',
    },
    warning: {
      root: 'border-amber-500/30 bg-amber-500/10',
      title: 'text-amber-950 dark:text-amber-100',
      message: 'text-amber-800 dark:text-amber-200',
    },
  }

  return (
    <div className={cn('rounded-[1.05rem] border px-3.5 py-3', toneClasses[tone].root)}>
      <p className={cn('text-sm font-medium', toneClasses[tone].title)}>
        {element.props.title}
      </p>
      {element.props.message ? (
        <p className={cn('mt-1 text-xs leading-5', toneClasses[tone].message)}>
          {element.props.message}
        </p>
      ) : null}
    </div>
  )
}

function TextInputField({
  element,
  bindings,
}: ComponentRenderProps<TextInputProps>) {
  const { interactive, busy } = useInteractiveMode()
  const [boundValue, setBoundValue] = useBoundProp<string>(
    element.props.value ?? undefined,
    bindings?.value,
  )
  const [localValue, setLocalValue] = React.useState(element.props.value ?? '')
  const isBound = Boolean(bindings?.value)
  const value = isBound ? (boundValue ?? '') : localValue
  const setValue = isBound ? setBoundValue : setLocalValue
  const validationConfig = React.useMemo(
    () =>
      buildTextValidationConfig({
        label: element.props.label,
        required: element.props.required,
        requiredMessage: element.props.requiredMessage,
        minLength: element.props.minLength,
        maxLength: element.props.maxLength,
        pattern: element.props.pattern,
        patternMessage: element.props.patternMessage,
      }),
    [
      element.props.label,
      element.props.required,
      element.props.requiredMessage,
      element.props.minLength,
      element.props.maxLength,
      element.props.pattern,
      element.props.patternMessage,
    ],
  )
  const fieldValidation = useFieldValidation(bindings?.value ?? '', validationConfig)
  const showErrors =
    isBound
    && (fieldValidation.state.touched || fieldValidation.state.validated)
    && fieldValidation.errors.length > 0

  return (
    <label className="block space-y-1.5">
      <FieldLabel label={element.props.label} required={element.props.required} />
      <Input
        value={value}
        disabled={!interactive || busy}
        required={element.props.required}
        minLength={element.props.minLength}
        maxLength={element.props.maxLength}
        pattern={element.props.pattern}
        aria-invalid={showErrors}
        onChange={(event) => {
          setValue(event.target.value)
          if (isBound && fieldValidation.state.touched) {
            scheduleValidation(fieldValidation.validate)
          }
        }}
        onBlur={() => {
          if (!isBound) return
          fieldValidation.touch()
          fieldValidation.validate()
        }}
        placeholder={element.props.placeholder}
        className={cn(
          'h-10',
          surfaceTransitionClass,
          showErrors && 'border-destructive/60 ring-1 ring-destructive/20',
        )}
      />
      <FieldSupportText
        helpText={element.props.helpText}
        errors={showErrors ? fieldValidation.errors : undefined}
        counter={
          typeof element.props.maxLength === 'number'
            ? `${value.length}/${element.props.maxLength}`
            : undefined
        }
      />
    </label>
  )
}

function TextAreaField({
  element,
  bindings,
}: ComponentRenderProps<TextAreaProps>) {
  const { interactive, busy } = useInteractiveMode()
  const [boundValue, setBoundValue] = useBoundProp<string>(
    element.props.value ?? undefined,
    bindings?.value,
  )
  const [localValue, setLocalValue] = React.useState(element.props.value ?? '')
  const isBound = Boolean(bindings?.value)
  const value = isBound ? (boundValue ?? '') : localValue
  const setValue = isBound ? setBoundValue : setLocalValue
  const validationConfig = React.useMemo(
    () =>
      buildTextValidationConfig({
        label: element.props.label,
        required: element.props.required,
        requiredMessage: element.props.requiredMessage,
        minLength: element.props.minLength,
        maxLength: element.props.maxLength,
      }),
    [
      element.props.label,
      element.props.required,
      element.props.requiredMessage,
      element.props.minLength,
      element.props.maxLength,
    ],
  )
  const fieldValidation = useFieldValidation(bindings?.value ?? '', validationConfig)
  const showErrors =
    isBound
    && (fieldValidation.state.touched || fieldValidation.state.validated)
    && fieldValidation.errors.length > 0

  return (
    <label className="block space-y-1.5">
      <FieldLabel label={element.props.label} required={element.props.required} />
      <Textarea
        value={value}
        disabled={!interactive || busy}
        required={element.props.required}
        minLength={element.props.minLength}
        maxLength={element.props.maxLength}
        aria-invalid={showErrors}
        onChange={(event) => {
          setValue(event.target.value)
          if (isBound && fieldValidation.state.touched) {
            scheduleValidation(fieldValidation.validate)
          }
        }}
        onBlur={() => {
          if (!isBound) return
          fieldValidation.touch()
          fieldValidation.validate()
        }}
        placeholder={element.props.placeholder}
        rows={element.props.rows ?? 4}
        className={cn(
          'min-h-[104px]',
          surfaceTransitionClass,
          showErrors && 'border-destructive/60 ring-1 ring-destructive/20',
        )}
      />
      <FieldSupportText
        helpText={element.props.helpText}
        errors={showErrors ? fieldValidation.errors : undefined}
        counter={
          typeof element.props.maxLength === 'number'
            ? `${value.length}/${element.props.maxLength}`
            : undefined
        }
      />
    </label>
  )
}

function SelectInputField({
  element,
  bindings,
}: ComponentRenderProps<SelectInputProps>) {
  const { interactive, busy } = useInteractiveMode()
  const [boundValue, setBoundValue] = useBoundProp<string>(
    element.props.value ?? undefined,
    bindings?.value,
  )
  const [localValue, setLocalValue] = React.useState(element.props.value ?? '')
  const isBound = Boolean(bindings?.value)
  const value = isBound ? (boundValue ?? '') : localValue
  const setValue = isBound ? setBoundValue : setLocalValue
  const validationConfig = React.useMemo(
    () =>
      buildChoiceValidationConfig({
        label: element.props.label,
        required: element.props.required,
        requiredMessage: element.props.requiredMessage,
      }),
    [element.props.label, element.props.required, element.props.requiredMessage],
  )
  const fieldValidation = useFieldValidation(bindings?.value ?? '', validationConfig)
  const showErrors =
    isBound
    && (fieldValidation.state.touched || fieldValidation.state.validated)
    && fieldValidation.errors.length > 0

  return (
    <label className="block space-y-1.5">
      <FieldLabel label={element.props.label} required={element.props.required} />
      <Select
        value={value || undefined}
        disabled={!interactive || busy}
        onValueChange={(nextValue) => {
          setValue(nextValue)
          if (isBound) {
            fieldValidation.touch()
            scheduleValidation(fieldValidation.validate)
          }
        }}
      >
        <SelectTrigger
          className={cn(
            'h-10 w-full',
            surfaceTransitionClass,
            showErrors && 'border-destructive/60 ring-1 ring-destructive/20',
          )}
          aria-invalid={showErrors}
        >
          <SelectValue placeholder={element.props.placeholder ?? 'Select an option'} />
        </SelectTrigger>
        <SelectContent>
          {element.props.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldSupportText
        helpText={element.props.helpText}
        errors={showErrors ? fieldValidation.errors : undefined}
      />
    </label>
  )
}

function ChoiceGroupField({
  element,
  bindings,
}: ComponentRenderProps<ChoiceGroupProps>) {
  const { interactive, busy } = useInteractiveMode()
  const [boundValue, setBoundValue] = useBoundProp<string>(
    element.props.value ?? undefined,
    bindings?.value,
  )
  const [localValue, setLocalValue] = React.useState(element.props.value ?? '')
  const isBound = Boolean(bindings?.value)
  const value = isBound ? (boundValue ?? '') : localValue
  const setValue = isBound ? setBoundValue : setLocalValue
  const validationConfig = React.useMemo(
    () =>
      buildChoiceValidationConfig({
        label: element.props.label,
        required: element.props.required,
        requiredMessage: element.props.requiredMessage,
      }),
    [element.props.label, element.props.required, element.props.requiredMessage],
  )
  const fieldValidation = useFieldValidation(bindings?.value ?? '', validationConfig)
  const showErrors =
    isBound
    && (fieldValidation.state.touched || fieldValidation.state.validated)
    && fieldValidation.errors.length > 0

  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <FieldLabel label={element.props.label} required={element.props.required} />
        <FieldSupportText
          helpText={element.props.helpText}
          errors={showErrors ? fieldValidation.errors : undefined}
        />
      </div>
      <div className="grid gap-2.5">
        {element.props.options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              disabled={!interactive || busy}
              aria-pressed={selected}
              onClick={() => {
                setValue(option.value)
                if (isBound) {
                  fieldValidation.touch()
                  scheduleValidation(fieldValidation.validate)
                }
              }}
              className={cn(
                'min-h-11 rounded-[1.15rem] border px-3.5 py-3 text-left',
                surfaceTransitionClass,
                focusRingClass,
                'active:translate-y-px',
                selected
                  ? 'border-primary/40 bg-primary/8 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_40%,transparent)]'
                  : showErrors
                    ? 'border-destructive/40 bg-destructive/[0.03] hover:bg-destructive/[0.05]'
                    : 'border-border/70 bg-background/80 hover:bg-muted/35',
                (!interactive || busy) && 'cursor-default opacity-70',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  {option.description ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'mt-1 size-2.5 shrink-0 rounded-full border border-border/50 bg-background/80',
                    selected && 'border-primary/0 bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_16%,transparent)]',
                  )}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ActionRowBlock({
  children,
}: ComponentRenderProps<ActionRowProps>) {
  return (
    <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
      {children}
    </div>
  )
}

function ActionButtonBlock({
  element,
  on,
}: ComponentRenderProps<ActionButtonProps>) {
  const { interactive, busy } = useInteractiveMode()
  const validation = useOptionalValidation()
  const press = on('press')
  const variantMap: Record<NonNullable<ActionButtonProps['variant']>, 'default' | 'outline' | 'ghost'> = {
    primary: 'default',
    secondary: 'outline',
    ghost: 'ghost',
  }
  const variant = variantMap[element.props.variant ?? 'primary']

  return (
    <div className="space-y-1 text-right">
      <Button
        type="button"
        variant={variant}
        disabled={!interactive || busy || !press.bound}
        className={cn(
          'min-h-11 w-full rounded-xl px-4 text-sm shadow-sm sm:w-auto sm:min-w-[9rem]',
          surfaceTransitionClass,
        )}
        onClick={() => {
          if (element.props.validate && validation && !validation.validateAll()) {
            return
          }
          void press.emit()
        }}
      >
        {busy ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
        {element.props.label}
      </Button>
      {element.props.hint ? (
        <p className="text-left text-[11px] leading-5 text-muted-foreground sm:text-right">
          {element.props.hint}
        </p>
      ) : null}
    </div>
  )
}

const DocAgentPageRenderer = createRenderer(docAgentInteractivePageCatalog, {
  Page: PageBlock,
  Section: SectionBlock,
  Text: TextBlock,
  Callout: CalloutBlock,
  TextInput: TextInputField,
  TextArea: TextAreaField,
  SelectInput: SelectInputField,
  ChoiceGroup: ChoiceGroupField,
  ActionRow: ActionRowBlock,
  ActionButton: ActionButtonBlock,
})

export type DocAgentInteractivePageResponse = Record<string, unknown> & {
  action: string
  values: Record<string, unknown>
}

interface DocAgentInteractivePageProps {
  spec: unknown
  message?: string
  className?: string
  submitting?: boolean
  error?: string | null
  onRespond?: (response: DocAgentInteractivePageResponse) => void | Promise<void>
}

export function DocAgentInteractivePage({
  spec,
  message,
  className,
  submitting = false,
  error = null,
  onRespond,
}: DocAgentInteractivePageProps) {
  const validated = React.useMemo(() => validateDocAgentInteractivePageSpec(spec), [spec])
  const interactive = Boolean(onRespond)
  const [pageState, setPageState] = React.useState<Record<string, unknown>>({})
  const stateRef = React.useRef<Record<string, unknown>>({})

  React.useEffect(() => {
    if (!validated.success) {
      setPageState({})
      stateRef.current = {}
      return
    }

    const nextState = getInitialStateFromSpec(spec)
    setPageState(nextState)
    stateRef.current = nextState
  }, [spec, validated])

  const handleStateChange = React.useCallback(
    (changes: Array<{ path: string; value: unknown }>) => {
      setPageState((current) => {
        const next = applyStateChanges(current, changes)
        stateRef.current = next
        return next
      })
    },
    [],
  )

  const handleAction = React.useCallback(
    async (actionName: string, params?: Record<string, unknown>) => {
      if (!interactive || actionName !== 'respond' || !onRespond) return

      const action = typeof params?.action === 'string' ? params.action.trim() : ''
      if (!action) return

      await onRespond({
        action,
        values: cloneState(stateRef.current),
      })
    },
    [interactive, onRespond],
  )

  return (
    <div
      aria-busy={submitting}
      className={cn(
        'overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/[0.04] p-3',
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.26em] text-muted-foreground uppercase">
            {interactive ? 'Interactive page' : 'Interactive preview'}
          </p>
          {message ? (
            <p className="max-w-prose text-sm leading-6 text-foreground whitespace-pre-wrap">
              {message}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {submitting ? (
            <Badge variant="secondary" className="gap-1 text-[10px]" aria-live="polite">
              <Loader2 className="size-3 animate-spin" />
              Sending reply
            </Badge>
          ) : null}
          {!interactive ? <Badge variant="outline">Preview</Badge> : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {validated.success ? (
        <InteractiveModeContext.Provider value={{ interactive, busy: submitting }}>
          <DocAgentPageRenderer
            spec={validated.data}
            state={pageState}
            loading={submitting}
            onStateChange={handleStateChange}
            onAction={handleAction}
          />
        </InteractiveModeContext.Provider>
      ) : (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {validated.error}
        </div>
      )}
    </div>
  )
}
