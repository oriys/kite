import { ExternalLink, PencilLine, Trash2 } from 'lucide-react'

import {
  getAiProviderDocsUrl,
  type AiProviderConfigListItem,
} from '@/lib/ai'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

const numberFormatter = new Intl.NumberFormat('en-US')

export type ProviderCard = {
  id: string
  name: string
  providerType: AiProviderConfigListItem['providerType']
  providerLabel: string
  baseUrl: string
  defaultModelId: string
  enabled: boolean
  source: 'database' | 'env'
  modelCount: number
  error?: string
  editableConfig: AiProviderConfigListItem | null
}

interface ProviderCardItemProps {
  provider: ProviderCard
  onEdit: (provider: ProviderCard) => void
  onDelete: (provider: ProviderCard) => void
  onToggle: (provider: ProviderCard, enabled: boolean) => void
  mutating: boolean
}

export function ProviderCardItem({
  provider,
  onEdit,
  onDelete,
  onToggle,
  mutating,
}: ProviderCardItemProps) {
  return (
    <article className="rounded-xl border border-border/70 bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {provider.name}
            </h3>
            <Badge variant="outline">{provider.providerLabel}</Badge>
            <Badge variant={provider.enabled ? 'secondary' : 'outline'}>
              {provider.enabled ? 'Enabled' : 'Hidden'}
            </Badge>
            {provider.source === 'env' ? (
              <Badge variant="outline">Env fallback</Badge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {provider.baseUrl || 'No endpoint configured'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {provider.editableConfig ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(provider)}
              >
                <PencilLine data-icon="inline-start" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(provider)}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            </>
          ) : null}
          <a
            href={getAiProviderDocsUrl(provider.providerType)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
          >
            Docs
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {numberFormatter.format(provider.modelCount)} synced models
        </Badge>
        {provider.defaultModelId ? (
          <Badge variant="outline" className="max-w-full truncate">
            Provider default {provider.defaultModelId}
          </Badge>
        ) : null}
        {provider.editableConfig?.apiKeyHint ? (
          <Badge variant="outline">
            Key {provider.editableConfig.apiKeyHint}
          </Badge>
        ) : null}
      </div>

      {provider.error ? (
        <p className="mt-3 text-xs leading-5 text-destructive">
          {provider.error}
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {provider.enabled
            ? 'This provider contributes models to the workspace catalog.'
            : 'This provider is saved but excluded from model routing until re-enabled.'}
        </p>
      )}

      {provider.editableConfig ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-foreground">
              Include in catalog
            </p>
            <p className="text-xs text-muted-foreground">
              Disable a provider without deleting its credentials.
            </p>
          </div>
          <Switch
            checked={provider.enabled}
            onCheckedChange={(checked) => onToggle(provider, checked)}
            aria-label={`Enable ${provider.name}`}
            disabled={mutating}
          />
        </div>
      ) : null}
    </article>
  )
}
