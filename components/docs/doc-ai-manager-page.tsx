'use client'

import * as React from 'react'
import {
  Bot,
  BrainCircuit,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'

import { formatAiContextWindow } from '@/lib/ai'
import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
import { cn } from '@/lib/utils'
import { DocsAdminShell } from '@/components/docs/docs-admin-shell'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
  const {
    items,
    loading,
    error,
    configured,
    providerName,
    baseUrl,
    defaultModelId,
    fetchedAt,
    refresh,
  } = useAiModels()
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
  const [openProvider, setOpenProvider] = React.useState<string | null>(null)
  const deferredSearch = React.useDeferredValue(search)

  const filteredItems = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    const originalPositionById = new Map(items.map((model, index) => [model.id, index]))
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

    return [...visibleItems].sort((left, right) => {
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
  }, [activeModelId, deferredSearch, enabledModelIds, items])

  const providerGroups = React.useMemo(() => {
    const activeProvider =
      items.find((model) => model.id === activeModelId)?.provider.trim() || null

    const groups = Array.from(
      filteredItems.reduce((acc, model) => {
        const provider = model.provider.trim() || 'Unknown provider'
        const current = acc.get(provider) ?? []
        current.push(model)
        acc.set(provider, current)
        return acc
      }, new Map<string, typeof filteredItems>()),
    ).map(([provider, models]) => {
      const enabledCountInGroup = models.filter((model) => enabledModelIds.includes(model.id)).length
      const activeGroupModel = models.find((model) => model.id === activeModelId) ?? null

      return {
        provider,
        models,
        enabledCountInGroup,
        activeGroupModel,
      }
    })

    return groups.sort((left, right) => {
      if (left.provider === activeProvider) return -1
      if (right.provider === activeProvider) return 1
      if (left.enabledCountInGroup !== right.enabledCountInGroup) {
        return right.enabledCountInGroup - left.enabledCountInGroup
      }
      return left.provider.localeCompare(right.provider)
    })
  }, [activeModelId, enabledModelIds, filteredItems, items])

  React.useEffect(() => {
    if (providerGroups.length === 0) {
      setOpenProvider(null)
      return
    }

    if (openProvider && providerGroups.some((group) => group.provider === openProvider)) {
      return
    }

    setOpenProvider(
      providerGroups.find((group) => group.activeGroupModel)?.provider ??
        providerGroups.find((group) => group.enabledCountInGroup > 0)?.provider ??
        providerGroups[0]?.provider ??
        null,
    )
  }, [openProvider, providerGroups])

  const activeLabel = activeModel?.label || activeModel?.id || 'Not selected'
  const enabledCount = numberFormatter.format(enabledModels.length)
  const totalCount = numberFormatter.format(items.length)
  const allProviderCount = numberFormatter.format(
    new Set(items.map((model) => model.provider.trim() || 'Unknown provider')).size,
  )
  const visibleProviderCount = numberFormatter.format(providerGroups.length)

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
          <Badge variant="outline">{providerName || 'AIHubMix'} catalog</Badge>
          <Badge variant="outline">{allProviderCount} providers</Badge>
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
      <div className="grid gap-4">
        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="editorial-section-kicker">Routing</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Search once, then pin a default model
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Keep the enabled set short. Grouped providers make it easier to scan the
                  catalog without opening every model at once.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefault}
                disabled={items.length === 0}
              >
                Reset default
              </Button>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-2">
              <p className="editorial-section-kicker">Search</p>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search model id, label, or provider"
                  aria-label="Search AI models"
                />
              </InputGroup>
              <p className="text-xs leading-5 text-muted-foreground">
                {numberFormatter.format(filteredItems.length)} models visible across{' '}
                {visibleProviderCount} provider groups.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="editorial-section-kicker">Default AI</p>
                <Badge variant="outline">{enabledCount} enabled</Badge>
              </div>
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
              <div className="flex flex-wrap gap-2">
                {enabledModels.length === 0 ? (
                  <Badge variant="outline">No enabled models yet</Badge>
                ) : (
                  enabledModels.slice(0, 5).map((model) => (
                    <Badge
                      key={model.id}
                      variant={activeModelId === model.id ? 'secondary' : 'outline'}
                    >
                      {model.label}
                    </Badge>
                  ))
                )}
                {enabledModels.length > 5 ? (
                  <Badge variant="outline">+{enabledModels.length - 5} more</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:px-5">
            <span className="min-w-0 flex-1 truncate">
              Endpoint {baseUrl || 'No endpoint configured'}
            </span>
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

        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <p className="editorial-section-kicker">Provider Groups</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              Expand one provider at a time
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Each provider opens to a compact list of models. Enable what writers should see,
              then set the default route only when that model should lead new sessions.
            </p>
          </div>

          {providerGroups.length === 0 ? (
            <Empty className="min-h-[300px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BrainCircuit />
                </EmptyMedia>
                <EmptyTitle>No models match this view</EmptyTitle>
                <EmptyDescription>
                  Try a different search or sync the catalog again.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={openProvider ?? undefined}
              onValueChange={(value) => setOpenProvider(value || null)}
              className="px-4 sm:px-5"
            >
              {providerGroups.map((group) => (
                <AccordionItem key={group.provider} value={group.provider}>
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold tracking-tight text-foreground">
                          {group.provider}
                        </span>
                        <Badge variant="outline">
                          {numberFormatter.format(group.models.length)} models
                        </Badge>
                        <Badge
                          variant={group.enabledCountInGroup > 0 ? 'secondary' : 'outline'}
                        >
                          {numberFormatter.format(group.enabledCountInGroup)} enabled
                        </Badge>
                        {group.activeGroupModel ? (
                          <Badge variant="secondary">
                            Default {group.activeGroupModel.label}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {group.enabledCountInGroup > 0
                          ? 'Contains models currently visible in the editor.'
                          : 'All models in this provider are currently hidden from the editor.'}
                      </p>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pb-5">
                    <div className="divide-y divide-border/70 border-t border-border/70">
                      {group.models.map((model) => {
                        const isEnabled = enabledModelIds.includes(model.id)
                        const isActive = activeModelId === model.id
                        const contextWindow = formatAiContextWindow(model.contextWindow)

                        return (
                          <article
                            key={model.id}
                            className={cn(
                              'grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center',
                              isActive && 'bg-primary/[0.04]',
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3
                                  className="truncate text-sm font-semibold tracking-tight text-foreground"
                                  title={model.label}
                                >
                                  {model.label}
                                </h3>
                                {isActive ? <Badge variant="secondary">Default</Badge> : null}
                                {!isActive && isEnabled ? (
                                  <Badge variant="outline">Enabled</Badge>
                                ) : null}
                                {contextWindow ? (
                                  <Badge variant="outline">{contextWindow} ctx</Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {model.id}
                              </p>
                              {model.description ? (
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                  {model.description}
                                </p>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                              {isActive ? (
                                <Badge variant="secondary">Default route</Badge>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setActiveModelId(model.id)}
                                >
                                  Set default
                                </Button>
                              )}
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {isEnabled ? 'Enabled' : 'Hidden'}
                                </span>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => toggleModel(model.id, checked)}
                                  aria-label={`Enable ${model.label}`}
                                />
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </section>
      </div>
    </DocsAdminShell>
  )
}
