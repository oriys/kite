import * as React from 'react'

import {
  getAiProviderDefaultBaseUrl,
  type AiProviderFormValues,
} from '@/lib/ai'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface ProviderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  values: AiProviderFormValues
  onValuesChange: React.Dispatch<React.SetStateAction<AiProviderFormValues>>
  onProviderTypeChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  error: string | null
  mutating: boolean
}

export function ProviderFormDialog({
  open,
  onOpenChange,
  mode,
  values,
  onValuesChange,
  onProviderTypeChange,
  onSubmit,
  error,
  mutating,
}: ProviderFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Add AI provider' : 'Edit AI provider'}
            </DialogTitle>
            <DialogDescription>
              Save provider credentials in the workspace database, then sync its model
              catalog into the editor.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto py-4">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="ai-provider-name">Connection name</FieldLabel>
                <FieldContent>
                  <Input
                    id="ai-provider-name"
                    value={values.name}
                    onChange={(event) =>
                      onValuesChange((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Primary Anthropic"
                    aria-invalid={Boolean(error && !values.name.trim())}
                  />
                  <FieldDescription>
                    Keep it short. This name appears in the AI model picker.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-provider-type">Provider type</FieldLabel>
                <FieldContent>
                  <Select
                    value={values.providerType}
                    onValueChange={onProviderTypeChange}
                  >
                    <SelectTrigger id="ai-provider-type" className="w-full">
                      <SelectValue placeholder="Select a provider type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="openai_compatible">
                          OpenAI-compatible
                        </SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    OpenAI-compatible works for AIHubMix and other `/models` + `/chat/completions`
                    providers.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-provider-url">Base URL</FieldLabel>
                <FieldContent>
                  <Input
                    id="ai-provider-url"
                    value={values.baseUrl}
                    onChange={(event) =>
                      onValuesChange((current) => ({
                        ...current,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder={getAiProviderDefaultBaseUrl(values.providerType)}
                  />
                  <FieldDescription>
                    Leave the default unless this provider uses a custom endpoint.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-provider-key">API key</FieldLabel>
                <FieldContent>
                  <Input
                    id="ai-provider-key"
                    type="password"
                    value={values.apiKey}
                    onChange={(event) =>
                      onValuesChange((current) => ({
                        ...current,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder={
                      mode === 'edit'
                        ? 'Leave blank to keep the saved key'
                        : 'sk-...'
                    }
                  />
                  <FieldDescription>
                    {mode === 'edit'
                      ? 'Leave blank to keep the existing key. Enter a new key only when you want to replace it.'
                      : 'The key is stored with this workspace provider configuration.'}
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-provider-default-model">
                  Provider default model
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="ai-provider-default-model"
                    value={values.defaultModelId}
                    onChange={(event) =>
                      onValuesChange((current) => ({
                        ...current,
                        defaultModelId: event.target.value,
                      }))
                    }
                    placeholder="gpt-4o-mini or claude-sonnet-4-5"
                  />
                  <FieldDescription>
                    Optional fallback model used before the catalog is synced or when the
                    provider is temporarily unreachable.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-provider-enabled">Include in catalog</FieldLabel>
                <FieldContent>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Provider visibility
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Disabled providers stay saved but their models disappear from the
                        workspace catalog.
                      </p>
                    </div>
                    <Switch
                      id="ai-provider-enabled"
                      checked={values.enabled}
                      onCheckedChange={(checked) =>
                        onValuesChange((current) => ({
                          ...current,
                          enabled: checked,
                        }))
                      }
                    />
                  </div>
                </FieldContent>
              </Field>
            </FieldGroup>

            {error ? (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={mutating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutating}>
              {mutating
                ? mode === 'create'
                  ? 'Adding…'
                  : 'Saving…'
                : mode === 'create'
                  ? 'Add Provider'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
