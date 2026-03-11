'use client'

import * as React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Bot,
  PencilLine,
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
import { DocsAiMenu } from '@/components/docs/docs-ai-menu'
import { DocsHeaderUtilities } from '@/components/docs/docs-header-utilities'
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
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="editorial-surface overflow-hidden editorial-reveal">
        <div className="grid gap-6 border-b border-border/70 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_auto] lg:items-start">
          <div className="flex flex-col gap-4">
            <p className="editorial-section-kicker">AI Action Studio</p>
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Route every AI action through its own model and instruction set.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Pin each rewrite, review, translation, or custom action to different enabled
                models, then tune the prompt each one receives.
                Unassigned actions fall back to the current default AI automatically.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Managed Actions
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {numberFormatter.format(AI_TRANSFORM_ACTIONS.length)}
                </p>
              </div>
              <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Custom Overrides
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {numberFormatter.format(draftCustomizedCount)}
                </p>
              </div>
              <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Enabled Models
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  {aiModelsLoading ? 'Syncing...' : numberFormatter.format(enabledModels.length)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/docs">
                  <ArrowLeft data-icon="inline-start" />
                  Back to Documents
                </Link>
              </Button>
              <DocsAiMenu />
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
                Save actions
              </Button>
            </div>
            <DocsHeaderUtilities className="lg:ml-1 lg:border-l lg:border-border/60 lg:pl-3" />
          </div>
        </div>
        <div className="grid gap-3 px-5 py-4 sm:px-6">
          <Alert>
            <Bot />
            <AlertTitle>Browser-local action routing</AlertTitle>
            <AlertDescription>
              Model and prompt overrides are stored in local storage and sent with each
              editor request from this browser. If a dedicated model is removed or not
              set, the action falls back to the current default AI.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{numberFormatter.format(draftCustomizedCount)} customized</Badge>
            <Badge variant="outline">Per-action model routing</Badge>
            <Badge variant="outline">Token: {AI_PROMPT_LANGUAGE_TOKEN}</Badge>
          </div>
          {enabledModels.length === 0 ? (
            <Alert className="border-destructive/25">
              <Sparkles />
              <AlertTitle>No enabled models yet</AlertTitle>
              <AlertDescription>
                Open AI Models first and enable at least one model. You can still edit
                prompts now, but dedicated model routing stays disabled until the editor
                has a model pool to choose from.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
        <aside className="editorial-surface p-4 sm:p-5 editorial-reveal">
          <div className="flex flex-col gap-4">
            <div>
              <p className="editorial-section-kicker">Coverage</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                What this page controls
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The system prompt sets shared guardrails for every request. Each action can
                then choose its own enabled model and action-specific instruction.
              </p>
            </div>

            <Card className="py-0">
              <CardHeader className="border-b border-border/70 py-4">
                <CardTitle className="text-base">Route map</CardTitle>
                <CardDescription>
                  Review which actions are still inheriting the workspace default route.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 py-4">
                <div className="rounded-lg border border-border/75 bg-muted/35 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <PencilLine className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">System prompt</span>
                    </div>
                    <Badge
                      variant={
                        preparedDraft.systemPrompt === defaults.systemPrompt
                          ? 'outline'
                          : 'secondary'
                      }
                    >
                      {preparedDraft.systemPrompt === defaults.systemPrompt ? 'Default' : 'Custom'}
                    </Badge>
                  </div>
                </div>
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

                  return (
                    <div
                      key={action}
                      className="rounded-lg border border-border/75 bg-card/70 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {AI_ACTION_LABELS[action]}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant={
                                preparedDraft.actionPrompts[action] === defaults.actionPrompts[action]
                                  ? 'outline'
                                  : 'secondary'
                              }
                            >
                              {preparedDraft.actionPrompts[action] === defaults.actionPrompts[action]
                                ? 'Prompt default'
                                : 'Prompt custom'}
                            </Badge>
                            <Badge
                              variant={
                                preparedDraft.actionModelIds[action] === defaults.actionModelIds[action]
                                  ? 'outline'
                                  : 'secondary'
                              }
                            >
                              {preparedDraft.actionModelIds[action]
                                ? `Model ${getModelCaption(
                                    resolvedModelId,
                                    enabledModelById,
                                    defaultModelLabel,
                                  )}`
                                : `Model ${defaultModelLabel}`}
                            </Badge>
                            {hasUnavailableModel ? (
                              <Badge variant="outline">Unavailable model cleared on save</Badge>
                            ) : null}
                          </div>
                        </div>
                        <span className="max-w-[13rem] text-right text-[11px] leading-5 text-muted-foreground">
                          {ACTION_META[action].description}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Alert className="border-border/80 bg-muted/30">
              <Sparkles />
              <AlertTitle>Translation token</AlertTitle>
              <AlertDescription>
                Use <code>{AI_PROMPT_LANGUAGE_TOKEN}</code> in the translate prompt to
                inject the language chosen in the editor menu.
              </AlertDescription>
            </Alert>
          </div>
        </aside>

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
                      className="min-h-36 leading-6"
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
                {formatCharacterCount(draftPrompts.systemPrompt)} / {numberFormatter.format(MAX_AI_SYSTEM_PROMPT_LENGTH)}
              </span>
            </CardFooter>
          </Card>

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

            return (
              <Card key={action} className="editorial-reveal">
                <CardHeader className="border-b border-border/70">
                  <CardTitle>{AI_ACTION_LABELS[action]} action</CardTitle>
                  <CardDescription>{ACTION_META[action].description}</CardDescription>
                  <CardAction>
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
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-5 py-5">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor={`ai-model-${action}`}>Dedicated model</FieldLabel>
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
                          <SelectTrigger id={`ai-model-${action}`} className="h-11 w-full">
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
                            ? `This action is pinned to ${getModelCaption(
                                resolvedModelId,
                                enabledModelById,
                                defaultModelLabel,
                              )}.`
                            : `When unset, this action uses the current default AI: ${defaultModelLabel}.`}
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`ai-action-${action}`}>Instruction</FieldLabel>
                      <FieldContent>
                        <Textarea
                          id={`ai-action-${action}`}
                          value={draftPrompts.actionPrompts[action]}
                          onChange={(event) => setActionPrompt(action, event.target.value)}
                          maxLength={MAX_AI_ACTION_PROMPT_LENGTH}
                          className="min-h-32 leading-6"
                          placeholder={defaults.actionPrompts[action]}
                        />
                        <FieldDescription>
                          {ACTION_META[action].helper} Leave empty to fall back to the default
                          instruction when you save.
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldGroup>

                  {action === 'translate' ? (
                    <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
                      <p className="editorial-section-kicker">Resolved preview</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {resolveAiPromptTemplate(
                          draftPrompts.actionPrompts.translate || defaults.actionPrompts.translate,
                          'Simplified Chinese',
                        )}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="justify-between border-t border-border/70 pt-4 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        preparedDraft.actionPrompts[action] === defaults.actionPrompts[action]
                          ? 'outline'
                          : 'secondary'
                      }
                    >
                      {preparedDraft.actionPrompts[action] === defaults.actionPrompts[action]
                        ? 'Prompt default'
                        : 'Prompt custom'}
                    </Badge>
                    <Badge
                      variant={
                        preparedDraft.actionModelIds[action] === defaults.actionModelIds[action]
                          ? 'outline'
                          : 'secondary'
                      }
                    >
                      {preparedDraft.actionModelIds[action] ? 'Model custom' : 'Model default'}
                    </Badge>
                    {hasUnavailableModel ? (
                      <Badge variant="outline">Unavailable model will reset on save</Badge>
                    ) : null}
                  </div>
                  <span>
                    {formatCharacterCount(draftPrompts.actionPrompts[action])} / {numberFormatter.format(MAX_AI_ACTION_PROMPT_LENGTH)}
                  </span>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
