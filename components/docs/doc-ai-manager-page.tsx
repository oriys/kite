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
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="editorial-surface overflow-hidden editorial-reveal">
        <div className="grid gap-6 border-b border-border/70 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_auto] lg:items-start">
          <div className="flex flex-col gap-4">
            <p className="editorial-section-kicker">AI Control Center</p>
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Curate which AI models the editor is allowed to use.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Fetch the AIHubMix catalog, enable the models your workspace trusts, and
                choose the default assistant that appears in the editor bubble menu.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Supported AI
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {loading ? '…' : totalCount}
                </p>
              </div>
              <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Enabled in Editor
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {loading ? '…' : enabledCount}
                </p>
              </div>
              <div className="rounded-lg border border-border/75 bg-muted/35 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Active AI
                </p>
                <p className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground">
                  {loading ? 'Syncing…' : activeLabel}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
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
                Fetch models
              </Button>
          </div>
        </div>
        <div className="grid gap-3 px-5 py-4 sm:px-6">
          <Alert>
            <Bot />
            <AlertTitle>{providerName || 'AIHubMix'} catalog</AlertTitle>
            <AlertDescription>
              The editor bubble menu only exposes models you enable here. Selecting a model
              in the floating AI menu will switch among this enabled subset.
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={configured ? 'secondary' : 'outline'}>
              {configured ? 'Configured' : 'Fallback'}
            </Badge>
            <Badge variant="outline">{baseUrl || 'No endpoint'}</Badge>
            <Badge variant="outline">Last fetch {formatFetchedAt(fetchedAt)}</Badge>
          </div>
          {error ? (
            <Alert className="border-destructive/25">
              <Sparkles />
              <AlertTitle>Catalog is using a safe fallback</AlertTitle>
              <AlertDescription>
                {error} The page still works, but the list may only show the current default
                model until the provider key is configured.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="editorial-surface p-4 sm:p-5 editorial-reveal">
          <div className="grid gap-4 border-b border-border/70 pb-4 xl:grid-cols-[minmax(0,1fr)_180px_minmax(260px,320px)] xl:items-start">
            <div className="flex flex-col gap-3">
              <p className="editorial-section-kicker">Search Supported AI</p>
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
            <div className="flex flex-col gap-2 xl:pt-0.5">
              <p className="editorial-section-kicker">Provider</p>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-11">
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
            <div className="flex flex-col gap-2 xl:pt-0.5">
              <p className="editorial-section-kicker">Default AI</p>
              <Select
                value={activeModelId ?? undefined}
                onValueChange={(value) => setActiveModelId(value)}
                disabled={items.length === 0}
              >
                <SelectTrigger className="h-11">
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
              <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                Sets the default model used in the editor.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {filteredItems.length === 0 ? (
              <Empty className="min-h-[420px]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BrainCircuit />
                  </EmptyMedia>
                  <EmptyTitle>No AI matches this search</EmptyTitle>
                  <EmptyDescription>
                    Try a different query or provider filter, or refresh the catalog from AIHubMix.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/75 bg-card/60">
                <div className="divide-y divide-border/60">
                  {filteredItems.map((model, index) => {
                    const isEnabled = enabledModelIds.includes(model.id)
                    const isActive = activeModelId === model.id

                    return (
                      <article
                        key={model.id}
                        className={cn(
                          'group flex items-center gap-3 px-3 py-2.5 transition-colors sm:px-4',
                          isActive && 'bg-primary/[0.06]',
                        )}
                        style={{ animationDelay: `${index * 24}ms` }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <div className="min-w-0">
                            <h2
                              className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-[0.95rem]"
                              title={model.label}
                            >
                              {model.label}
                            </h2>
                          </div>
                          <Badge
                            variant="outline"
                            className="hidden shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline-flex"
                          >
                            {model.provider}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs text-muted-foreground sm:hidden">
                            {model.provider}
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
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6 editorial-reveal">
          <section className="editorial-surface p-5">
            <p className="editorial-section-kicker">Enabled in Floating AI Menu</p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {enabledCount} model{enabledModels.length === 1 ? '' : 's'} live
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  These are the only models shown in the editor bubble menu. Pick a smaller,
                  trusted subset so switching stays fast.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetToDefault}>
                Reset
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {enabledModels.length === 0 ? (
                <Empty className="min-h-[220px]">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SwitchCamera />
                    </EmptyMedia>
                    <EmptyTitle>No enabled AI yet</EmptyTitle>
                    <EmptyDescription>
                      Enable at least one model on the left. The editor menu will then let
                      you switch among them inline.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                enabledModels.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setActiveModelId(model.id)}
                    className={cn(
                      'w-full rounded-2xl border border-border/75 px-4 py-3 text-left transition-colors',
                      activeModelId === model.id
                        ? 'border-primary/45 bg-primary/[0.06]'
                        : 'bg-card/70 hover:bg-muted/35',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{model.label}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {model.id}
                        </p>
                      </div>
                      {activeModelId === model.id ? (
                        <Badge variant="default">Current</Badge>
                      ) : (
                        <Badge variant="outline">Enabled</Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="editorial-surface p-5">
            <p className="editorial-section-kicker">Provider Notes</p>
            <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                Model discovery is fetched server-side from AIHubMix, so keys stay on the
                server and never touch the browser.
              </p>
              <p>
                The active AI selected here becomes the default for new editor sessions, but
                writers can still switch to any enabled model from the floating AI menu.
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
    </div>
  )
}
