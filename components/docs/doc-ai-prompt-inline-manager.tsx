'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Bot, Check } from 'lucide-react'

import {
  AI_ACTION_LABELS,
  AI_TRANSFORM_ACTIONS,
  type AiCatalogModel,
  type AiTransformAction,
} from '@/lib/ai'
import {
  MAX_AI_ACTION_PROMPT_LENGTH,
  MAX_AI_SYSTEM_PROMPT_LENGTH,
  countCustomizedAiPrompts,
  createDefaultAiPromptSettings,
  type AiPromptSettings,
} from '@/lib/ai-prompts'
import { useAiPrompts } from '@/hooks/use-ai-prompts'
import { cn } from '@/lib/utils'
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

type PromptTarget = 'system' | AiTransformAction

interface DocAiPromptInlineManagerProps {
  activeModelId: string | null
  enabledModels: AiCatalogModel[]
}

const PROMPT_META = {
  system: {
    title: 'System prompt',
  },
  ...Object.fromEntries(
    Object.entries(AI_ACTION_LABELS).map(([action, title]) => [action, { title }]),
  ),
} as Record<PromptTarget, { title: string }>

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

function getPromptValue(target: PromptTarget, prompts: AiPromptSettings) {
  return target === 'system' ? prompts.systemPrompt : prompts.actionPrompts[target]
}

export function DocAiPromptInlineManager({
  activeModelId,
  enabledModels,
}: DocAiPromptInlineManagerProps) {
  const { prompts, savePrompts } = useAiPrompts()
  const defaults = React.useMemo(() => createDefaultAiPromptSettings(), [])
  const [selectedTarget, setSelectedTarget] = React.useState<PromptTarget>('polish')
  const [draftPrompts, setDraftPrompts] = React.useState<AiPromptSettings>(prompts)

  React.useEffect(() => {
    setDraftPrompts(prompts)
  }, [prompts])

  const activeModel = React.useMemo(
    () =>
      enabledModels.find((model) => model.id === activeModelId) ?? enabledModels[0] ?? null,
    [enabledModels, activeModelId],
  )
  const enabledModelById = React.useMemo(
    () => new Map(enabledModels.map((model) => [model.id, model])),
    [enabledModels],
  )
  const selectedMeta = PROMPT_META[selectedTarget]
  const selectedDefaultValue = getPromptValue(selectedTarget, defaults)
  const selectedValue = getPromptValue(selectedTarget, draftPrompts)
  const selectedLength = selectedValue.length
  const selectedMaxLength =
    selectedTarget === 'system'
      ? MAX_AI_SYSTEM_PROMPT_LENGTH
      : MAX_AI_ACTION_PROMPT_LENGTH
  const selectedIsDefault = selectedValue === selectedDefaultValue
  const draftOverrideCount = React.useMemo(
    () => countCustomizedAiPrompts(draftPrompts),
    [draftPrompts],
  )
  const isDirty = React.useMemo(
    () => !arePromptSettingsEqual(draftPrompts, prompts),
    [draftPrompts, prompts],
  )
  const selectedModelOverride =
    selectedTarget === 'system'
      ? ''
      : draftPrompts.actionModelIds[selectedTarget]
  const selectedModelLabel =
    selectedModelOverride
      ? enabledModelById.get(selectedModelOverride)?.label ?? selectedModelOverride
      : activeModel?.label ?? 'Current default AI'

  const handleValueChange = React.useCallback(
    (value: string) => {
      setDraftPrompts((current) =>
        selectedTarget === 'system'
          ? { ...current, systemPrompt: value }
          : {
              ...current,
              actionPrompts: {
                ...current.actionPrompts,
                [selectedTarget]: value,
              },
            },
      )
    },
    [selectedTarget],
  )

  const handleResetCurrent = React.useCallback(() => {
    setDraftPrompts((current) =>
      selectedTarget === 'system'
        ? { ...current, systemPrompt: defaults.systemPrompt }
        : {
            ...current,
            actionPrompts: {
              ...current.actionPrompts,
              [selectedTarget]: defaults.actionPrompts[selectedTarget],
            },
          },
    )
  }, [defaults, selectedTarget])

  const handleSave = React.useCallback(() => {
    savePrompts(draftPrompts)
    toast.success('AI prompts saved', {
      description: `${selectedMeta.title} is ready to test in this editor.`,
    })
  }, [draftPrompts, savePrompts, selectedMeta.title])

  return (
    <div className="flex min-h-[27rem] max-h-[min(36rem,calc(100vh-8rem))] flex-col">
      <div className="border-b border-border/70 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Prompt lab
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              Tweak prompts without leaving the editor
            </p>
          </div>
          <Badge variant={isDirty ? 'secondary' : 'outline'}>
            {isDirty ? 'Unsaved' : 'Saved'}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{draftOverrideCount} total overrides</Badge>
          <Badge variant="outline" className="max-w-[16rem] truncate">
            AI {selectedModelLabel}
          </Badge>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[138px_minmax(0,1fr)]">
        <div className="overflow-y-auto border-r border-border/70 p-2">
          <div className="space-y-1">
            <button
              type="button"
              className={cn(
                'w-full rounded-lg px-2.5 py-2 text-left transition-colors',
                selectedTarget === 'system'
                  ? 'bg-primary/[0.08] text-foreground'
                  : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground',
              )}
              onClick={() => setSelectedTarget('system')}
            >
              <span className="block text-[11px] font-medium uppercase tracking-[0.14em]">
                System
              </span>
              <span className="mt-1 block text-xs leading-5">
                Shared rules
              </span>
            </button>

            {AI_TRANSFORM_ACTIONS.map((action) => {
              const isSelected = selectedTarget === action
              const isDefault =
                draftPrompts.actionPrompts[action] === defaults.actionPrompts[action]

              return (
                <button
                  key={action}
                  type="button"
                  className={cn(
                    'w-full rounded-lg px-2.5 py-2 text-left transition-colors',
                    isSelected
                      ? 'bg-primary/[0.08] text-foreground'
                      : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground',
                  )}
                  onClick={() => setSelectedTarget(action)}
                >
                  <span className="block text-xs font-medium text-current">
                    {AI_ACTION_LABELS[action]}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4">
                    {isDefault ? 'Default' : 'Custom'}
                    {draftPrompts.actionModelIds[action] ? ' · Routed' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex flex-col">
          <div className="border-b border-border/70 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {selectedMeta.title}
                </p>
              </div>
              <Badge variant={selectedIsDefault ? 'outline' : 'secondary'}>
                {selectedIsDefault ? 'Default' : 'Custom'}
              </Badge>
            </div>
            <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
              <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <Bot className="mt-0.5 size-3.5 shrink-0" />
                <div>
                  {selectedTarget === 'system'
                    ? 'This prompt runs before every action in this workspace.'
                    : selectedModelOverride
                      ? `A dedicated model route is active for this action: ${selectedModelLabel}.`
                      : `This action currently tests against ${selectedModelLabel}.`}
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ai-inline-prompt">Prompt</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="ai-inline-prompt"
                    value={selectedValue}
                    onChange={(event) => handleValueChange(event.target.value)}
                    maxLength={selectedMaxLength}
                    className="min-h-[14rem] text-[13px] leading-6"
                    placeholder={
                      selectedTarget === 'system'
                        ? 'Leave blank to use the default system prompt'
                        : 'Leave blank to use the default action prompt'
                    }
                  />
                  <FieldDescription>
                    {selectedTarget === 'system'
                      ? 'Leave blank to use the default system prompt.'
                      : 'Leave blank to use the default action prompt.'}
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-3">
            <div className="text-[11px] text-muted-foreground">
              {selectedLength} / {selectedMaxLength}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetCurrent}
              >
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!isDirty}
              >
                <Check data-icon="inline-start" className="size-3.5" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
