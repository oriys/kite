'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Bot,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

import {
  AI_ACTION_LABELS,
  AI_TRANSFORM_ACTIONS,
  type AiCatalogModel,
  type AiTransformAction,
} from '@/lib/ai'
import {
  AI_PROMPT_LANGUAGE_TOKEN,
  MAX_AI_ACTION_PROMPT_LENGTH,
  MAX_AI_SYSTEM_PROMPT_LENGTH,
  countCustomizedAiPrompts,
  createDefaultAiPromptSettings,
  resolveAiActionModel,
  resolveAiPromptTemplate,
  sanitizeAiPromptSettings,
  type AiPromptSettings,
} from '@/lib/ai-prompts'
import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
import { useAiPrompts } from '@/hooks/use-ai-prompts'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { DocsAdminShell } from '@/components/docs/docs-admin-shell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const numberFormatter = new Intl.NumberFormat('en-US')
const DEFAULT_MODEL_VALUE = '__workspace-default__'

const ACTION_META: Record<
  AiTransformAction,
  { description: string; helper: string }
> = {
  polish: {
    description: 'Refine selected text without changing the intent or structure.',
    helper: 'Useful when drafts need editorial cleanup before review.',
  },
  shorten: {
    description: 'Compress verbose sections into a tighter, clearer version.',
    helper: 'Keep key facts, trim repetition, and preserve ordering.',
  },
  expand: {
    description: 'Add explanation and supporting detail without inventing facts.',
    helper: 'Best for shallow sections that need more clarity or context.',
  },
  translate: {
    description: 'Translate while preserving markdown, code blocks, and terminology.',
    helper: `Use ${AI_PROMPT_LANGUAGE_TOKEN} anywhere the target language should appear.`,
  },
  explain: {
    description: 'Explain technical text in plainer language for wider audiences.',
    helper: 'Use when a section needs more context, not just rewriting.',
  },
  review: {
    description: 'Produce a technical-editor review report for the full draft.',
    helper: 'Great for coverage checks, clarity issues, and concrete fix recommendations.',
  },
  score: {
    description: 'Grade the document with a rubric and a short final verdict.',
    helper: 'Useful when you want an at-a-glance quality signal before review.',
  },
  summarize: {
    description: 'Generate an executive summary of the document.',
    helper: 'Best for turning long drafts into a fast review briefing.',
  },
  outline: {
    description: 'Extract the real structure as a clean hierarchical outline.',
    helper: 'Use when the draft needs structure review or navigation scaffolding.',
  },
  checklist: {
    description: 'Convert the draft into a practical checklist of next actions.',
    helper: 'Useful for launch readiness, QA sweeps, or implementation follow-ups.',
  },
  custom: {
    description: 'Run a one-off instruction that the user writes against the selected text.',
    helper: 'The runtime prompt from the editor dialog is appended after this base instruction.',
  },
}

function arePromptSettingsEqual(
  left: AiPromptSettings,
  right: AiPromptSettings,
) {
  if (left.systemPrompt !== right.systemPrompt) {
    return false
  }

  return AI_TRANSFORM_ACTIONS.every(
    (action) =>
      left.actionPrompts[action] === right.actionPrompts[action] &&
      left.actionModelIds[action] === right.actionModelIds[action],
  )
}

function formatCharacterCount(value: string) {
  return numberFormatter.format(value.length)
}

function getModelCaption(
  modelId: string | null,
  enabledModelById: Map<string, AiCatalogModel>,
  fallbackLabel: string,
) {
  if (!modelId) {
    return fallbackLabel
  }

  return enabledModelById.get(modelId)?.label ?? fallbackLabel
}

export function DocAiPromptManagerPage() {
  const {
    items: aiModels,
    defaultModelId,
    loading: aiModelsLoading,
  } = useAiModels()
  const {
    enabledModels,
    activeModel,
    activeModelId,
  } = useAiPreferences(aiModels, defaultModelId)
  const { prompts, savePrompts, resetPrompts } = useAiPrompts()
  const defaults = React.useMemo(() => createDefaultAiPromptSettings(), [])
  const [draftPrompts, setDraftPrompts] = React.useState<AiPromptSettings>(prompts)

  React.useEffect(() => {
    setDraftPrompts(prompts)
  }, [prompts])

  const enabledModelIds = React.useMemo(
    () => enabledModels.map((model) => model.id),
    [enabledModels],
  )
  const enabledModelById = React.useMemo(
    () => new Map(enabledModels.map((model) => [model.id, model])),
    [enabledModels],
  )
  const defaultModelLabel = activeModel?.label ?? 'Workspace default AI'

  const preparedDraft = React.useMemo(
    () =>
      sanitizeAiPromptSettings({
        ...draftPrompts,
        actionModelIds: AI_TRANSFORM_ACTIONS.reduce(
          (acc, action) => {
            const modelId = draftPrompts.actionModelIds[action]?.trim() ?? ''
            acc[action] =
              modelId && enabledModelIds.includes(modelId) ? modelId : ''
            return acc
          },
          {} as Record<AiTransformAction, string>,
        ),
      }),
    [draftPrompts, enabledModelIds],
  )
  const isDirty = React.useMemo(
    () => !arePromptSettingsEqual(preparedDraft, prompts),
    [preparedDraft, prompts],
  )
  const draftCustomizedCount = React.useMemo(
    () => countCustomizedAiPrompts(preparedDraft),
    [preparedDraft],
  )

  const setActionPrompt = React.useCallback(
    (action: AiTransformAction, value: string) => {
      setDraftPrompts((current) => ({
        ...current,
        actionPrompts: {
          ...current.actionPrompts,
          [action]: value,
        },
      }))
    },
    [],
  )

  const setActionModelId = React.useCallback(
    (action: AiTransformAction, value: string) => {
      setDraftPrompts((current) => ({
        ...current,
        actionModelIds: {
          ...current.actionModelIds,
          [action]: value === DEFAULT_MODEL_VALUE ? '' : value,
        },
      }))
    },
    [],
  )

  const handleSave = React.useCallback(() => {
    const savedPrompts = savePrompts(preparedDraft)
    setDraftPrompts(savedPrompts)
    toast.success('AI action settings saved', {
      description: 'Each editor action now uses its configured model and prompt on this browser.',
    })
  }, [preparedDraft, savePrompts])

  const handleResetAll = React.useCallback(() => {
    const nextPrompts = resetPrompts()
    setDraftPrompts(nextPrompts)
    toast.success('AI action settings restored', {
      description: 'All actions are back to the workspace-default model and prompt behavior.',
    })
  }, [resetPrompts])

  return (
    <DocsAdminShell
      kicker="AI Prompts"
      title="Override only the actions that need special handling."
      description="Keep shared guardrails in one place, then open a single action only when it truly needs a different model or a custom instruction."
      actions={(
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetAll}
            disabled={!isDirty && draftCustomizedCount === 0}
          >
            <RefreshCw data-icon="inline-start" />
            Restore defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty}>
            <Sparkles data-icon="inline-start" />
            Save changes
          </Button>
        </>
      )}
      meta={(
        <>
          <Badge variant={isDirty ? 'secondary' : 'outline'}>
            {isDirty ? 'Unsaved changes' : 'Saved'}
          </Badge>
          <Badge variant="outline">
            {numberFormatter.format(AI_TRANSFORM_ACTIONS.length)} actions
          </Badge>
          <Badge variant="outline">
            {numberFormatter.format(draftCustomizedCount)} customized
          </Badge>
          <Badge variant="outline">
            {aiModelsLoading
              ? 'Syncing models'
              : `${numberFormatter.format(enabledModels.length)} enabled models`}
          </Badge>
          <Badge variant="outline" className="max-w-full truncate sm:max-w-[20rem]">
            Default {defaultModelLabel}
          </Badge>
          <Badge variant="outline">Token {AI_PROMPT_LANGUAGE_TOKEN}</Badge>
        </>
      )}
      notice={(
        <div className="grid gap-3">
          <Alert>
            <Bot />
            <AlertTitle>Browser-local routing</AlertTitle>
            <AlertDescription>
              Overrides live in local storage on this browser. If a dedicated model disappears,
              the action quietly falls back to the current workspace default when you save.
            </AlertDescription>
          </Alert>
          {enabledModels.length === 0 ? (
            <Alert className="border-destructive/25">
              <Sparkles />
              <AlertTitle>No enabled models yet</AlertTitle>
              <AlertDescription>
                Open AI Models first and enable at least one model. You can still edit prompts
                now, but per-action routing will stay inactive until the editor has a model pool.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}
    >
      <div className="grid gap-4">
        <Card className="editorial-reveal">
          <CardHeader className="border-b border-border/70">
            <CardTitle>System prompt</CardTitle>
            <CardDescription>
              Shared guardrails sent before every AI request, regardless of action.
            </CardDescription>
            <CardAction>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraftPrompts((current) => ({
                    ...current,
                    systemPrompt: defaults.systemPrompt,
                  }))
                }
              >
                Reset
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="py-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ai-system-prompt">Shared instruction</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="ai-system-prompt"
                    value={draftPrompts.systemPrompt}
                    onChange={(event) =>
                      setDraftPrompts((current) => ({
                        ...current,
                        systemPrompt: event.target.value,
                      }))
                    }
                    maxLength={MAX_AI_SYSTEM_PROMPT_LENGTH}
                    className="min-h-32 leading-6"
                    placeholder={defaults.systemPrompt}
                  />
                  <FieldDescription>
                    Leave empty to fall back to the default system prompt when you save.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-between border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <span>Shapes tone, formatting discipline, and output constraints.</span>
            <span>
              {formatCharacterCount(draftPrompts.systemPrompt)} /{' '}
              {numberFormatter.format(MAX_AI_SYSTEM_PROMPT_LENGTH)}
            </span>
          </CardFooter>
        </Card>

        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <p className="editorial-section-kicker">Action Overrides</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              Per-action model and prompt routing
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Most actions should stay on the shared defaults. Expand only the ones that
              genuinely need a different model or a more specific instruction.
            </p>
          </div>

          <Accordion type="single" collapsible className="px-4 sm:px-5">
            {AI_TRANSFORM_ACTIONS.map((action) => {
              const rawModelId = draftPrompts.actionModelIds[action]?.trim() ?? ''
              const hasUnavailableModel =
                Boolean(rawModelId) && !enabledModelIds.includes(rawModelId)
              const resolvedModelId = resolveAiActionModel(
                action,
                preparedDraft,
                activeModelId,
                enabledModelIds,
              )
              const promptIsDefault =
                preparedDraft.actionPrompts[action] === defaults.actionPrompts[action]
              const modelIsDefault =
                preparedDraft.actionModelIds[action] === defaults.actionModelIds[action]

              return (
                <AccordionItem key={action} value={action}>
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold tracking-tight text-foreground">
                          {AI_ACTION_LABELS[action]}
                        </span>
                        <Badge variant={promptIsDefault ? 'outline' : 'secondary'}>
                          {promptIsDefault ? 'Prompt default' : 'Prompt custom'}
                        </Badge>
                        <Badge variant={modelIsDefault ? 'outline' : 'secondary'}>
                          {modelIsDefault
                            ? `Model ${defaultModelLabel}`
                            : `Model ${getModelCaption(
                                resolvedModelId,
                                enabledModelById,
                                defaultModelLabel,
                              )}`}
                        </Badge>
                        {hasUnavailableModel ? (
                          <Badge variant="outline">Resets on save</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                        {ACTION_META[action].description}
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                      <div className="space-y-4">
                        <div className="rounded-lg border border-border/75 bg-muted/30 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">Route</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Choose a dedicated model only when the action benefits from a
                                different default.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDraftPrompts((current) => ({
                                  ...current,
                                  actionPrompts: {
                                    ...current.actionPrompts,
                                    [action]: defaults.actionPrompts[action],
                                  },
                                  actionModelIds: {
                                    ...current.actionModelIds,
                                    [action]: defaults.actionModelIds[action],
                                  },
                                }))
                              }
                            >
                              Reset
                            </Button>
                          </div>
                          <div className="mt-3">
                            <FieldGroup>
                              <Field>
                                <FieldLabel htmlFor={`ai-model-${action}`}>
                                  Dedicated model
                                </FieldLabel>
                                <FieldContent>
                                  <Select
                                    value={
                                      rawModelId && enabledModelIds.includes(rawModelId)
                                        ? rawModelId
                                        : DEFAULT_MODEL_VALUE
                                    }
                                    onValueChange={(value) => setActionModelId(action, value)}
                                    disabled={enabledModels.length === 0}
                                  >
                                    <SelectTrigger
                                      id={`ai-model-${action}`}
                                      className="h-10 w-full"
                                    >
                                      <SelectValue placeholder="Choose a model for this action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        <SelectItem value={DEFAULT_MODEL_VALUE}>
                                          Use workspace default ({defaultModelLabel})
                                        </SelectItem>
                                        {enabledModels.map((model) => (
                                          <SelectItem key={model.id} value={model.id}>
                                            {model.label}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  <FieldDescription>
                                    {rawModelId && !hasUnavailableModel
                                      ? `Pinned to ${getModelCaption(
                                          resolvedModelId,
                                          enabledModelById,
                                          defaultModelLabel,
                                        )}.`
                                      : `Falls back to the current default AI: ${defaultModelLabel}.`}
                                  </FieldDescription>
                                </FieldContent>
                              </Field>
                            </FieldGroup>
                          </div>
                        </div>

                        <Alert className="border-border/80 bg-muted/25">
                          <Sparkles />
                          <AlertTitle>Writing note</AlertTitle>
                          <AlertDescription>
                            {ACTION_META[action].helper} Leave the field empty to restore the
                            default instruction when you save.
                          </AlertDescription>
                        </Alert>
                      </div>

                      <div className="space-y-4">
                        <FieldGroup>
                          <Field>
                            <FieldLabel htmlFor={`ai-action-${action}`}>Instruction</FieldLabel>
                            <FieldContent>
                              <Textarea
                                id={`ai-action-${action}`}
                                value={draftPrompts.actionPrompts[action]}
                                onChange={(event) => setActionPrompt(action, event.target.value)}
                                maxLength={MAX_AI_ACTION_PROMPT_LENGTH}
                                className="min-h-36 leading-6"
                                placeholder={defaults.actionPrompts[action]}
                              />
                              <FieldDescription>
                                Keep it short, task-specific, and compatible with the shared
                                system guardrails.
                              </FieldDescription>
                            </FieldContent>
                          </Field>
                        </FieldGroup>

                        {action === 'translate' ? (
                          <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
                            <p className="editorial-section-kicker">Resolved preview</p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {resolveAiPromptTemplate(
                                draftPrompts.actionPrompts.translate ||
                                  defaults.actionPrompts.translate,
                                'Simplified Chinese',
                              )}
                            </p>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={promptIsDefault ? 'outline' : 'secondary'}>
                              {promptIsDefault ? 'Prompt default' : 'Prompt custom'}
                            </Badge>
                            <Badge variant={modelIsDefault ? 'outline' : 'secondary'}>
                              {modelIsDefault ? 'Model default' : 'Model custom'}
                            </Badge>
                          </div>
                          <span>
                            {formatCharacterCount(draftPrompts.actionPrompts[action])} /{' '}
                            {numberFormatter.format(MAX_AI_ACTION_PROMPT_LENGTH)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </section>
      </div>
    </DocsAdminShell>
  )
}
