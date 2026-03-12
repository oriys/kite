'use client'

import * as React from 'react'
import {
  Bot,
  BrainCircuit,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  SwitchCamera,
} from 'lucide-react'

import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
import { cn } from '@/lib/utils'
import { DocsAdminShell } from '@/components/docs/docs-admin-shell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

const numberFormatter = new Intl.NumberFormat('en-US')

function formatFetchedAt(value: string) {
  if (!value) return 'Not synced yet'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not synced yet'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function DocAiManagerPage() {
  const { items, loading, error, configured, providerName, baseUrl, defaultModelId, fetchedAt, refresh } =
    useAiModels()
  const {
    enabledModels,
    activeModel,
    activeModelId,
    enabledModelIds,
    toggleModel,
    setActiveModelId,
    resetToDefault,
  } = useAiPreferences(items, defaultModelId)
  const [search, setSearch] = React.useState('')
  const [providerFilter, setProviderFilter] = React.useState('all')
  const deferredSearch = React.useDeferredValue(search)
  const providerOptions = React.useMemo(
    () => [
      'all',
      ...Array.from(
        new Set(
          items
            .map((model) => model.provider.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    ],
    [items],
  )

  React.useEffect(() => {
    if (providerFilter !== 'all' && !providerOptions.includes(providerFilter)) {
      setProviderFilter('all')
    }
  }, [providerFilter, providerOptions])

  const filteredItems = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    const originalPositionById = new Map(
      items.map((model, index) => [model.id, index]),
    )
    const enabledPositionById = new Map(
      enabledModelIds.map((modelId, index) => [modelId, index]),
    )

    const visibleItems = normalizedSearch
      ? items.filter((model) => {
          const haystack = [model.id, model.label, model.provider]
            .join(' ')
            .toLowerCase()

          return haystack.includes(normalizedSearch)
        })
      : items

    const visibleByProvider =
      providerFilter === 'all'
        ? visibleItems
        : visibleItems.filter((model) => model.provider === providerFilter)

    return [...visibleByProvider].sort((left, right) => {
      if (left.id === activeModelId) return -1
      if (right.id === activeModelId) return 1

      const leftEnabledIndex = enabledPositionById.get(left.id)
      const rightEnabledIndex = enabledPositionById.get(right.id)

      if (leftEnabledIndex !== undefined && rightEnabledIndex !== undefined) {
        return leftEnabledIndex - rightEnabledIndex
      }

      if (leftEnabledIndex !== undefined) return -1
      if (rightEnabledIndex !== undefined) return 1

      return (
        (originalPositionById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (originalPositionById.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      )
    })
  }, [activeModelId, deferredSearch, enabledModelIds, items, providerFilter])

  const activeLabel = activeModel?.label || activeModel?.id || 'Not selected'
  const enabledCount = numberFormatter.format(enabledModels.length)
  const totalCount = numberFormatter.format(items.length)

  return (
    <DocsAdminShell
      kicker="AI Models"
      title="Keep the editor on a small, trusted model set."
      description="Sync the catalog, enable only the models writers should see, and keep one default route ready for every new editor session."
      actions={(
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw
            data-icon="inline-start"
            className={cn(loading && 'animate-spin')}
          />
          Sync catalog
        </Button>
      )}
      meta={(
        <>
          <Badge variant={configured ? 'secondary' : 'outline'}>
            {configured ? 'Configured' : 'Fallback'}
          </Badge>
          <Badge variant="outline">{providerName || 'AIHubMix'}</Badge>
          <Badge variant="outline">
            {loading ? 'Syncing catalog' : `${enabledCount}/${totalCount} enabled`}
          </Badge>
          <Badge variant="outline" className="max-w-full truncate sm:max-w-[22rem]">
            Default {activeLabel}
          </Badge>
          <Badge variant="outline">Last fetch {formatFetchedAt(fetchedAt)}</Badge>
        </>
      )}
      notice={(
        <div className="grid gap-3">
          <Alert>
            <Bot />
            <AlertTitle>{providerName || 'AIHubMix'} catalog</AlertTitle>
            <AlertDescription>
              Only enabled models appear in the editor bubble menu, so the fastest setup is
              usually a short, trusted list.
            </AlertDescription>
          </Alert>
          {error ? (
            <Alert className="border-destructive/25">
              <Sparkles />
              <AlertTitle>Catalog fallback is active</AlertTitle>
              <AlertDescription>
                {error} The page still works, but the list may only show the current default
                model until the provider key is configured.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="grid gap-3 border-b border-border/70 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex flex-col gap-2">
              <p className="editorial-section-kicker">Search</p>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search model or provider"
                  aria-label="Search AI models"
                />
              </InputGroup>
            </div>
            <div className="flex flex-col gap-2">
              <p className="editorial-section-kicker">Provider</p>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider === 'all' ? 'All providers' : provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BrainCircuit />
                </EmptyMedia>
                <EmptyTitle>No models match this view</EmptyTitle>
                <EmptyDescription>
                  Try a different search, clear the provider filter, or sync the catalog again.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredItems.map((model, index) => {
                const isEnabled = enabledModelIds.includes(model.id)
                const isActive = activeModelId === model.id

                return (
                  <article
                    key={model.id}
                    className={cn(
                      'grid gap-3 px-4 py-3 transition-colors sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center',
                      isActive && 'bg-primary/[0.06]',
                    )}
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          className="truncate text-sm font-semibold tracking-tight text-foreground"
                          title={model.label}
                        >
                          {model.label}
                        </h2>
                        <Badge variant="outline">{model.provider}</Badge>
                        {isActive ? <Badge variant="secondary">Default</Badge> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {model.id}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <span className="text-xs text-muted-foreground">
                        {isEnabled ? 'Enabled in editor' : 'Hidden from editor'}
                      </span>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => toggleModel(model.id, checked)}
                        aria-label={`Enable ${model.label}`}
                      />
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="grid gap-4 editorial-reveal xl:self-start">
          <section className="editorial-surface p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="editorial-section-kicker">Default Route</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Pick the model new sessions start with
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefault}
                disabled={enabledModels.length === 0}
              >
                Reset
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <p className="editorial-section-kicker">Default AI</p>
                <Select
                  value={activeModelId ?? undefined}
                  onValueChange={(value) => setActiveModelId(value)}
                  disabled={items.length === 0}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select the default AI" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[22rem]">
                    {items.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-muted-foreground">
                  Writers can still switch to any enabled model from the floating AI menu.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="editorial-section-kicker">Enabled subset</p>
                  <span className="text-xs text-muted-foreground">
                    {enabledCount} live
                  </span>
                </div>
                {enabledModels.length === 0 ? (
                  <Empty className="min-h-[180px]">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SwitchCamera />
                      </EmptyMedia>
                      <EmptyTitle>No enabled models yet</EmptyTitle>
                      <EmptyDescription>
                        Enable at least one model to make it available inside the editor.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="space-y-2">
                    {enabledModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setActiveModelId(model.id)}
                        className={cn(
                          'w-full rounded-lg border border-border/75 px-3 py-3 text-left transition-colors',
                          activeModelId === model.id
                            ? 'border-primary/40 bg-primary/[0.06]'
                            : 'bg-card/70 hover:bg-muted/35',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {model.label}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {model.id}
                            </p>
                          </div>
                          <Badge variant={activeModelId === model.id ? 'secondary' : 'outline'}>
                            {activeModelId === model.id ? 'Default' : 'Enabled'}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="editorial-surface p-4 sm:p-5">
            <p className="editorial-section-kicker">Catalog source</p>
            <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Endpoint</p>
                <p className="mt-1 break-all">{baseUrl || 'No endpoint configured'}</p>
              </div>
              <p>
                Model discovery stays server-side, so provider credentials never reach the
                browser.
              </p>
              <a
                href="https://docs.aihubmix.com/en"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
              >
                Open AIHubMix docs
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </section>
        </aside>
      </div>
    </DocsAdminShell>
  )
}
