import {
  AI_ACTION_LABELS,
  type AiCatalogModel,
  type AiTransformAction,
} from '@/lib/ai'
import {
  MAX_AI_ACTION_PROMPT_LENGTH,
  resolveAiActionModel,
  type AiPromptSettings,
} from '@/lib/ai-prompts'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface ActionOverrideItemProps {
  action: AiTransformAction
  draftPrompts: AiPromptSettings
  defaults: AiPromptSettings
  preparedDraft: AiPromptSettings
  activeModelId: string | null
  enabledModels: AiCatalogModel[]
  enabledModelIds: string[]
  enabledModelById: Map<string, AiCatalogModel>
  defaultModelLabel: string
  onPromptChange: (action: AiTransformAction, value: string) => void
  onModelChange: (action: AiTransformAction, value: string) => void
  onReset: (action: AiTransformAction) => void
}

export function ActionOverrideItem({
  action,
  draftPrompts,
  defaults,
  preparedDraft,
  activeModelId,
  enabledModels,
  enabledModelIds,
  enabledModelById,
  defaultModelLabel,
  onPromptChange,
  onModelChange,
  onReset,
}: ActionOverrideItemProps) {
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
    <AccordionItem value={action}>
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
                  onClick={() => onReset(action)}
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
                        onValueChange={(value) => onModelChange(action, value === DEFAULT_MODEL_VALUE ? '' : value)}
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

          </div>

          <div className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`ai-action-${action}`}>Instruction</FieldLabel>
                <FieldContent>
                  <Textarea
                    id={`ai-action-${action}`}
                    value={draftPrompts.actionPrompts[action]}
                    onChange={(event) => onPromptChange(action, event.target.value)}
                    maxLength={MAX_AI_ACTION_PROMPT_LENGTH}
                    className="min-h-36 leading-6"
                    placeholder="Leave blank to use the default action prompt"
                  />
                  <FieldDescription>
                    Leave blank to use the default action prompt.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>

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
}
