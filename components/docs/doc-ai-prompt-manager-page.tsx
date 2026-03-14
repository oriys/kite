'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Bot,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

import {
  AI_TRANSFORM_ACTIONS,
  type AiTransformAction,
} from '@/lib/ai'
import {
  MAX_AI_SYSTEM_PROMPT_LENGTH,
  countCustomizedAiPrompts,
  createDefaultAiPromptSettings,
  sanitizeAiPromptSettings,
  type AiPromptSettings,
} from '@/lib/ai-prompts'
import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
import { useAiPrompts } from '@/hooks/use-ai-prompts'
import { ActionOverrideItem } from '@/components/docs/doc-ai-action-override-item'
import { Accordion } from '@/components/ui/accordion'
import { DocsAdminShell } from '@/components/docs/docs-admin-shell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

const numberFormatter = new Intl.NumberFormat('en-US')

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

export function DocAiPromptManagerPage() {
  const {
    items: aiModels,
    defaultModelId,
    enabledModelIds: initialEnabledModelIds,
    loading: aiModelsLoading,
  } = useAiModels()
  const {
    enabledModels,
    activeModel,
    activeModelId,
  } = useAiPreferences(aiModels, defaultModelId, initialEnabledModelIds)
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
          [action]: value,
        },
      }))
    },
    [],
  )

  const handleSave = React.useCallback(() => {
    const savedPrompts = savePrompts(preparedDraft)
    setDraftPrompts(savedPrompts)
    toast.success('AI action settings saved', {
      description: 'Each editor action now uses its configured model and prompt for this workspace.',
    })
  }, [preparedDraft, savePrompts])

  const handleResetAll = React.useCallback(() => {
    const nextPrompts = resetPrompts()
    setDraftPrompts(nextPrompts)
    toast.success('AI action settings restored', {
      description: 'All actions are back to the workspace-default model and prompt behavior.',
    })
  }, [resetPrompts])

  const handleResetAction = React.useCallback(
    (action: AiTransformAction) => {
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
    },
    [defaults],
  )

  return (
    <DocsAdminShell
      kicker="AI Prompts"
      title="Manage AI prompts"
      description="Edit shared defaults and per-action overrides."
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
        </>
      )}
      notice={(
        <div className="grid gap-3">
          <Alert>
            <Bot />
            <AlertTitle>Workspace-shared routing</AlertTitle>
            <AlertDescription>
              Prompt overrides now live in the workspace database. If a dedicated model
              disappears, the action falls back to the current workspace default when you
              save.
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
        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="editorial-section-kicker">Shared Guardrails</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                System prompt
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Shared guardrails sent before every AI request, regardless of action.
              </p>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </div>

          <div className="px-4 py-4 sm:px-5">
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
                    placeholder="Leave blank to use the default system prompt"
                  />
                  <FieldDescription>
                    Leave blank to use the default system prompt.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:px-5">
            <span>
              {formatCharacterCount(draftPrompts.systemPrompt)} /{' '}
              {numberFormatter.format(MAX_AI_SYSTEM_PROMPT_LENGTH)}
            </span>
          </div>
        </section>

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
            {AI_TRANSFORM_ACTIONS.map((action) => (
              <ActionOverrideItem
                key={action}
                action={action}
                draftPrompts={draftPrompts}
                defaults={defaults}
                preparedDraft={preparedDraft}
                activeModelId={activeModelId}
                enabledModels={enabledModels}
                enabledModelIds={enabledModelIds}
                enabledModelById={enabledModelById}
                defaultModelLabel={defaultModelLabel}
                onPromptChange={setActionPrompt}
                onModelChange={setActionModelId}
                onReset={handleResetAction}
              />
            ))}
          </Accordion>
        </section>
      </div>
    </DocsAdminShell>
  )
}
