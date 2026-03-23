'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Bot,
  BrainCircuit,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'

import {
  createDefaultAiProviderFormValues,
  formatAiContextWindow,
  getAiProviderDefaultBaseUrl,
  HARDCODED_EMBEDDING_BASE_URL,
  HARDCODED_EMBEDDING_MODEL,
  HARDCODED_EMBEDDING_PROVIDER_NAME,
  type AiProviderFormValues,
} from '@/lib/ai'
import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
import { useAiProviders } from '@/hooks/use-ai-providers'
import { cn } from '@/lib/utils'
import { ProviderCardItem, type ProviderCard } from '@/components/docs/doc-ai-provider-card'
import { ProviderFormDialog } from '@/components/docs/doc-ai-provider-form-dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

const numberFormatter = new Intl.NumberFormat('en-US')
const INITIAL_ENABLED_MODEL_SUMMARY_LIMIT = 6
const INITIAL_PROVIDER_CARD_LIMIT = 4
const INITIAL_PROVIDER_GROUP_MODEL_LIMIT = 12

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

function formatEmbeddingRouteSummary(input: {
  providerName?: string | null
  modelId?: string | null
}) {
  const modelId = input.modelId?.trim() ?? ''
  const providerName = input.providerName?.trim() ?? ''

  if (!modelId && !providerName) {
    return 'Automatic'
  }

  if (!modelId) {
    return `${providerName} default`
  }

  return providerName ? `${providerName} · ${modelId}` : modelId
}

function createProviderValues(
  provider: ProviderCard,
): AiProviderFormValues {
  if (!provider.editableConfig) {
    return createDefaultAiProviderFormValues()
  }

  return {
    name: provider.editableConfig.name,
    providerType: provider.editableConfig.providerType,
    baseUrl: provider.editableConfig.baseUrl || getAiProviderDefaultBaseUrl(provider.editableConfig.providerType),
    apiKey: '',
    defaultModelId: provider.editableConfig.defaultModelId,
    enabled: provider.editableConfig.enabled,
  }
}

export function DocAiManagerPage() {
  const {
    items: aiModels,
    loading: aiModelsLoading,
    error: catalogError,
    configured,
    providers: catalogProviders,
    defaultModelId,
    enabledModelIds: initialEnabledModelIds,
    embeddingModelId: currentEmbeddingModelId,
    resolvedEmbeddingModelId,
    fetchedAt,
    refresh: refreshCatalog,
  } = useAiModels()
  const {
    enabledModels,
    activeModel,
    activeModelId,
    enabledModelIds,
    saving: savingModelSettings,
    toggleModel,
    setActiveModelId,
    resetToDefault,
  } = useAiPreferences(aiModels, defaultModelId, initialEnabledModelIds)
  const {
    items: providerConfigs,
    loading: providersLoading,
    mutating: providerMutating,
    error: providerError,
    refresh: refreshProviders,
    createProvider,
    updateProvider,
    deleteProvider,
  } = useAiProviders()
  const [search, setSearch] = React.useState('')
  const [showAllEnabledModelSummaries, setShowAllEnabledModelSummaries] =
    React.useState(false)
  const [showAllProviderCards, setShowAllProviderCards] = React.useState(false)
  const [openProviderGroup, setOpenProviderGroup] = React.useState<string | null>(
    null,
  )
  const [expandedProviderModelGroups, setExpandedProviderModelGroups] =
    React.useState<string[]>([])
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create')
  const [editingProviderId, setEditingProviderId] = React.useState<string | null>(
    null,
  )
  const [formValues, setFormValues] = React.useState<AiProviderFormValues>(() =>
    createDefaultAiProviderFormValues(),
  )
  const [formError, setFormError] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ProviderCard | null>(null)
  const deferredSearch = React.useDeferredValue(search)

  const refreshAll = React.useCallback(async () => {
    await Promise.all([
      refreshCatalog(),
      refreshProviders().catch(() => undefined),
    ])
  }, [refreshCatalog, refreshProviders])

  const providerCardById = React.useMemo(() => {
    const editableById = new Map(providerConfigs.map((provider) => [provider.id, provider]))
    const cards = new Map<string, ProviderCard>()

    for (const provider of providerConfigs) {
      cards.set(provider.id, {
        id: provider.id,
        name: provider.name,
        providerType: provider.providerType,
        providerLabel: provider.providerLabel,
        baseUrl: provider.baseUrl,
        defaultModelId: provider.defaultModelId,
        enabled: provider.enabled,
        source: 'database',
        modelCount: 0,
        editableConfig: provider,
      })
    }

    for (const summary of catalogProviders) {
      const editableConfig = editableById.get(summary.id) ?? null
      cards.set(summary.id, {
        id: summary.id,
        name: summary.name,
        providerType: summary.providerType,
        providerLabel: summary.providerLabel,
        baseUrl: summary.baseUrl,
        defaultModelId: summary.defaultModelId,
        enabled: summary.enabled,
        source: summary.source,
        modelCount: summary.modelCount,
        error: summary.error,
        editableConfig,
      })
    }

    return cards
  }, [catalogProviders, providerConfigs])

  const providerCards = React.useMemo(
    () => Array.from(providerCardById.values()),
    [providerCardById],
  )

  const filteredModels = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    const originalPositionById = new Map(aiModels.map((model, index) => [model.id, index]))
    const enabledPositionById = new Map(
      enabledModelIds.map((modelId, index) => [modelId, index]),
    )

    const visibleItems = normalizedSearch
      ? aiModels.filter((model) => {
          const haystack = [
            model.id,
            model.modelId,
            model.label,
            model.provider,
            model.providerType,
          ]
            .join(' ')
            .toLowerCase()

          return haystack.includes(normalizedSearch)
        })
      : aiModels

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
  }, [activeModelId, aiModels, deferredSearch, enabledModelIds])

  const providerGroups = React.useMemo(() => {
    const activeProviderId =
      aiModels.find((model) => model.id === activeModelId)?.providerId ?? null

    const groups = Array.from(
      filteredModels.reduce((acc, model) => {
        const current = acc.get(model.providerId) ?? []
        current.push(model)
        acc.set(model.providerId, current)
        return acc
      }, new Map<string, typeof filteredModels>()),
    ).map(([providerId, models]) => {
      const provider = providerCardById.get(providerId)
      const enabledCountInGroup = models.filter((model) =>
        enabledModelIds.includes(model.id),
      ).length
      const activeGroupModel =
        models.find((model) => model.id === activeModelId) ?? null

      return {
        providerId,
        providerName: provider?.name ?? models[0]?.provider ?? 'Unknown provider',
        providerLabel:
          provider?.providerLabel ?? provider?.providerType ?? models[0]?.providerType,
        providerType: provider?.providerType ?? models[0]?.providerType,
        models,
        enabledCountInGroup,
        activeGroupModel,
      }
    })

    return groups.sort((left, right) => {
      if (left.providerId === activeProviderId) return -1
      if (right.providerId === activeProviderId) return 1
      if (left.enabledCountInGroup !== right.enabledCountInGroup) {
        return right.enabledCountInGroup - left.enabledCountInGroup
      }
      return left.providerName.localeCompare(right.providerName)
    })
  }, [
    activeModelId,
    aiModels,
    enabledModelIds,
    filteredModels,
    providerCardById,
  ])

  const enabledModelSummaries = React.useMemo(
    () =>
      enabledModels.map((model) => {
        const provider = providerCardById.get(model.providerId)

        return {
          ...model,
          providerName: provider?.name ?? model.provider,
          providerLabel:
            provider?.providerLabel ?? provider?.providerType ?? model.providerType,
          contextWindowLabel: formatAiContextWindow(model.contextWindow),
        }
      }),
    [enabledModels, providerCardById],
  )

  const enabledProviderSummaryCount = React.useMemo(
    () => new Set(enabledModels.map((model) => model.providerId)).size,
    [enabledModels],
  )

  const visibleEnabledModelSummaries = showAllEnabledModelSummaries
    ? enabledModelSummaries
    : enabledModelSummaries.slice(0, INITIAL_ENABLED_MODEL_SUMMARY_LIMIT)

  const visibleProviderCards = showAllProviderCards
    ? providerCards
    : providerCards.slice(0, INITIAL_PROVIDER_CARD_LIMIT)

  React.useEffect(() => {
    if (providerGroups.length === 0) {
      if (openProviderGroup !== null) {
        setOpenProviderGroup(null)
      }
      return
    }

    if (
      openProviderGroup &&
      !providerGroups.some((group) => group.providerId === openProviderGroup)
    ) {
      setOpenProviderGroup(null)
    }
  }, [openProviderGroup, providerGroups])

  React.useEffect(() => {
    setExpandedProviderModelGroups((current) =>
      {
        const next = current.filter((providerId) =>
          providerGroups.some((group) => group.providerId === providerId),
        )

        return next.length === current.length &&
          next.every((providerId, index) => providerId === current[index])
          ? current
          : next
      },
    )
  }, [providerGroups])

  const defaultModelSelectValue = React.useMemo(() => {
    if (!activeModelId) return null

    return enabledModels.some((model) => model.id === activeModelId)
      ? activeModelId
      : null
  }, [activeModelId, enabledModels])

  const activeLabel = activeModel?.label || activeModel?.id || 'Not selected'
  const enabledCount = numberFormatter.format(enabledModels.length)
  const totalCount = numberFormatter.format(aiModels.length)
  const providerCount = numberFormatter.format(providerCards.length)
  const visibleProviderCount = numberFormatter.format(providerGroups.length)
  const dbProviderCount = providerCards.filter(
    (provider) => provider.source === 'database',
  ).length
  const effectiveEmbeddingSummary = formatEmbeddingRouteSummary({
    providerName: HARDCODED_EMBEDDING_PROVIDER_NAME,
    modelId: resolvedEmbeddingModelId || currentEmbeddingModelId || HARDCODED_EMBEDDING_MODEL,
  })

  const toggleExpandedProviderModelGroup = React.useCallback((providerId: string) => {
    setExpandedProviderModelGroups((current) =>
      current.includes(providerId)
        ? current.filter((value) => value !== providerId)
        : [...current, providerId],
    )
  }, [])

  const handleProviderTypeChange = React.useCallback((value: string) => {
    setFormValues((current) => {
      const providerType = value as AiProviderFormValues['providerType']

      return {
        ...current,
        providerType,
        baseUrl: getAiProviderDefaultBaseUrl(providerType),
      }
    })
  }, [])

  const openCreateDialog = React.useCallback(() => {
    setFormMode('create')
    setEditingProviderId(null)
    setFormValues(createDefaultAiProviderFormValues())
    setFormError(null)
    setFormOpen(true)
  }, [])

  const openEditDialog = React.useCallback((provider: ProviderCard) => {
    if (!provider.editableConfig) {
      return
    }

    setFormMode('edit')
    setEditingProviderId(provider.id)
    setFormValues(createProviderValues(provider))
    setFormError(null)
    setFormOpen(true)
  }, [])

  const handleProviderToggle = React.useCallback(
    async (provider: ProviderCard, enabled: boolean) => {
      if (!provider.editableConfig) return

      try {
        await updateProvider(provider.id, {
          ...createProviderValues(provider),
          enabled,
        })
        await refreshCatalog()
        toast.success(enabled ? 'Provider enabled' : 'Provider hidden', {
          description: `${provider.name} is ${enabled ? 'back in' : 'removed from'} the workspace AI catalog.`,
        })
      } catch (error) {
        toast.error('Unable to update provider', {
          description:
            error instanceof Error ? error.message : 'Please try again.',
        })
      }
    },
    [refreshCatalog, updateProvider],
  )

  const handleFormSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setFormError(null)

      try {
        if (!formValues.name.trim()) {
          throw new Error('Provider name is required.')
        }

        if (formMode === 'create' && !formValues.apiKey.trim()) {
          throw new Error('API key is required for a new provider.')
        }

        if (formMode === 'create') {
          await createProvider(formValues)
        } else if (editingProviderId) {
          await updateProvider(editingProviderId, formValues)
        }

        await refreshCatalog()
        setFormOpen(false)
        toast.success(
          formMode === 'create' ? 'Provider added' : 'Provider updated',
          {
            description:
              formMode === 'create'
                ? 'The AI catalog can now pull models from the new connection.'
                : 'Workspace AI routing now uses the updated provider settings.',
          },
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to save provider'
        setFormError(message)
      }
    },
    [
      createProvider,
      editingProviderId,
      formMode,
      formValues,
      refreshCatalog,
      updateProvider,
    ],
  )

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget?.editableConfig) {
      return
    }

    try {
      await deleteProvider(deleteTarget.id)
      await refreshCatalog()
      toast.success('Provider removed', {
        description: `${deleteTarget.name} is no longer available to the workspace AI catalog.`,
      })
      setDeleteTarget(null)
    } catch (error) {
      toast.error('Unable to delete provider', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }, [deleteProvider, deleteTarget, refreshCatalog])

  const isRefreshing =
    aiModelsLoading ||
    providersLoading ||
    providerMutating ||
    savingModelSettings

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">AI Models</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Connect multiple providers, sync their catalogs, and control which models the editor can route to.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refreshAll()}
              disabled={isRefreshing}
            >
              <RefreshCw
                data-icon="inline-start"
                className={cn(isRefreshing && 'animate-spin')}
              />
              Sync catalog
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus data-icon="inline-start" />
              Add provider
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={configured ? 'secondary' : 'outline'}>
            {configured ? 'Configured' : 'Fallback'}
          </Badge>
          <Badge variant="outline">{providerCount} providers</Badge>
          <Badge variant="outline">
            {isRefreshing ? 'Syncing catalog' : `${enabledCount}/${totalCount} enabled`}
          </Badge>
          <Badge variant="outline" className="max-w-full truncate sm:max-w-[22rem]">
            Default {activeLabel}
          </Badge>
          <Badge variant="outline">Last fetch {formatFetchedAt(fetchedAt)}</Badge>
        </div>
      </div>

      <div className="grid gap-3">
        <Alert>
          <Bot />
          <AlertTitle>Workspace AI connections</AlertTitle>
          <AlertDescription>
            Provider credentials, enabled models, and routing defaults now live in the
            database for this workspace instead of staying on one browser.
          </AlertDescription>
        </Alert>
        {catalogError ? (
          <Alert className="border-destructive/25">
            <Sparkles />
            <AlertTitle>Catalog warnings</AlertTitle>
            <AlertDescription>{catalogError}</AlertDescription>
          </Alert>
        ) : null}
        {providerError ? (
          <Alert className="border-destructive/25">
            <Sparkles />
            <AlertTitle>Provider list unavailable</AlertTitle>
            <AlertDescription>{providerError}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <section className="editorial-surface overflow-hidden editorial-reveal">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="editorial-section-kicker">Enabled Workspace Models</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                Keep the editor-visible set in one place
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                These are the models currently exposed in slash and bubble menus. Quick
                actions here cover the most common changes without opening every provider
                group.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={enabledModels.length > 0 ? 'secondary' : 'outline'}>
                {enabledCount} enabled
              </Badge>
              <Badge variant="outline">
                {numberFormatter.format(enabledProviderSummaryCount)} providers represented
              </Badge>
              <Badge
                variant={activeModel ? 'secondary' : 'outline'}
                className="max-w-full truncate sm:max-w-[22rem]"
              >
                {activeModel ? `Default ${activeLabel}` : 'No default selected'}
              </Badge>
            </div>
          </div>
        </div>

        {enabledModelSummaries.length === 0 ? (
          <Empty className="min-h-[220px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BrainCircuit />
              </EmptyMedia>
              <EmptyTitle>No enabled models yet</EmptyTitle>
              <EmptyDescription>
                Turn models on below to expose them in the editor and make one the
                workspace default.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-2 xl:grid-cols-3">
            {visibleEnabledModelSummaries.map((model) => {
              const isActive = activeModelId === model.id

              return (
                <article
                  key={model.id}
                  className={cn(
                    'rounded-xl border border-border/70 bg-background/70 p-4',
                    isActive && 'border-primary/25 bg-primary/[0.04]',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className="truncate text-sm font-semibold tracking-tight text-foreground"
                          title={model.label}
                        >
                          {model.label}
                        </h3>
                        <Badge variant={isActive ? 'secondary' : 'outline'}>
                          {isActive ? 'Default' : 'Enabled'}
                        </Badge>
                        <Badge variant="outline">{model.providerLabel}</Badge>
                        {model.contextWindowLabel ? (
                          <Badge variant="outline">{model.contextWindowLabel} ctx</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs font-medium text-foreground/85">
                        {model.providerName}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {model.modelId}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveModelId(model.id)}
                          disabled={savingModelSettings}
                        >
                          Set default
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleModel(model.id, false)}
                        disabled={savingModelSettings}
                      >
                        Hide
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {enabledModelSummaries.length > INITIAL_ENABLED_MODEL_SUMMARY_LIMIT ? (
          <div className="border-t border-border/70 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {showAllEnabledModelSummaries
                  ? `Showing all ${enabledCount} enabled models.`
                  : `Showing ${numberFormatter.format(visibleEnabledModelSummaries.length)} of ${enabledCount} enabled models.`}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setShowAllEnabledModelSummaries((current) => !current)
                }
              >
                {showAllEnabledModelSummaries
                  ? 'Show fewer'
                  : `Show all ${enabledCount}`}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4">
        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="editorial-section-kicker">Provider Connections</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Attach more than one AI supplier
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Each connection contributes its own model catalog. Use short, descriptive
                  names so writers can scan providers quickly.
                </p>
              </div>
              <Badge variant="outline">
                {numberFormatter.format(dbProviderCount)} saved in database
              </Badge>
            </div>
          </div>

          {providerCards.length === 0 ? (
            <Empty className="min-h-[260px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BrainCircuit />
                </EmptyMedia>
                <EmptyTitle>No AI provider configured</EmptyTitle>
                <EmptyDescription>
                  Add an OpenAI-compatible, Anthropic, or Gemini connection to start syncing
                  models for this workspace.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-2">
              {visibleProviderCards.map((provider) => (
                <ProviderCardItem
                  key={provider.id}
                  provider={provider}
                  onEdit={openEditDialog}
                  onDelete={setDeleteTarget}
                  onToggle={handleProviderToggle}
                  mutating={providerMutating}
                />
              ))}
            </div>
          )}

          {providerCards.length > INITIAL_PROVIDER_CARD_LIMIT ? (
            <div className="border-t border-border/70 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  {showAllProviderCards
                    ? `Showing all ${providerCount} provider connections.`
                    : `Showing ${numberFormatter.format(visibleProviderCards.length)} of ${providerCount} provider connections.`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllProviderCards((current) => !current)}
                >
                  {showAllProviderCards
                    ? 'Show fewer'
                    : `Show all ${providerCount}`}
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="editorial-section-kicker">Model Routing</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Search once, then pin a workspace default
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Only enabled models appear in the editor. Keep the active set short so the
                  bubble menu stays focused.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefault}
                disabled={aiModels.length === 0 || savingModelSettings}
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
                {numberFormatter.format(filteredModels.length)} models visible across{' '}
                {visibleProviderCount} provider groups.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="editorial-section-kicker">Default AI</p>
              {defaultModelSelectValue ? (
                <Select
                  value={defaultModelSelectValue}
                  onValueChange={(value) => setActiveModelId(value)}
                  disabled={savingModelSettings}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select the default AI" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[22rem]">
                    <SelectGroup>
                      {enabledModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-10 items-center rounded-md border border-input/80 bg-background/80 px-3 text-sm text-muted-foreground">
                  {enabledModels.length === 0
                    ? 'Enable a model below to choose a default route.'
                    : 'Choose a default model from the enabled set below.'}
                </div>
              )}
              <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{enabledCount} enabled</Badge>
                  <Badge variant={activeModel ? 'secondary' : 'outline'}>
                    {activeModel ? `Current default ${activeLabel}` : 'No default selected'}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {enabledModels.length === 0
                    ? 'Enable one or more models below to expose them in the editor.'
                    : 'The full enabled set now stays summarized above, so this picker can stay focused on the default route.'}
                </p>
              </div>
            </div>
          </div>

          {providerGroups.length === 0 ? (
            <Empty className="min-h-[300px] border-t border-border/70">
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
              value={openProviderGroup ?? ''}
              onValueChange={(value) => setOpenProviderGroup(value || null)}
              className="px-4 sm:px-5"
            >
              {providerGroups.map((group) => {
                const showAllModels = expandedProviderModelGroups.includes(
                  group.providerId,
                )
                const visibleModels = showAllModels
                  ? group.models
                  : group.models.slice(0, INITIAL_PROVIDER_GROUP_MODEL_LIMIT)

                return (
                  <AccordionItem key={group.providerId} value={group.providerId}>
                    <AccordionTrigger className="py-4 hover:no-underline">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold tracking-tight text-foreground">
                            {group.providerName}
                          </span>
                          <Badge variant="outline">{group.providerLabel}</Badge>
                          <Badge variant="outline">
                            {numberFormatter.format(group.models.length)} models
                          </Badge>
                          <Badge
                            variant={
                              group.enabledCountInGroup > 0 ? 'secondary' : 'outline'
                            }
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
                        {visibleModels.map((model) => {
                          const isEnabled = enabledModelIds.includes(model.id)
                          const isActive = activeModelId === model.id
                          const contextWindow = formatAiContextWindow(
                            model.contextWindow,
                          )

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
                                  {isActive ? (
                                    <Badge variant="secondary">Default</Badge>
                                  ) : null}
                                  {!isActive && isEnabled ? (
                                    <Badge variant="outline">Enabled</Badge>
                                  ) : null}
                                  {contextWindow ? (
                                    <Badge variant="outline">{contextWindow} ctx</Badge>
                                  ) : null}
                                </div>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {model.modelId}
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
                                    onCheckedChange={(checked) =>
                                      toggleModel(model.id, checked)
                                    }
                                    aria-label={`Enable ${model.label}`}
                                  />
                                </div>
                              </div>
                            </article>
                          )
                        })}
                      </div>

                      {group.models.length > INITIAL_PROVIDER_GROUP_MODEL_LIMIT ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
                          <p className="text-xs leading-5 text-muted-foreground">
                            {showAllModels
                              ? `Showing all ${numberFormatter.format(group.models.length)} models in this provider.`
                              : `Showing ${numberFormatter.format(visibleModels.length)} of ${numberFormatter.format(group.models.length)} models in this provider.`}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toggleExpandedProviderModelGroup(group.providerId)
                            }
                          >
                            {showAllModels
                              ? 'Show fewer'
                              : `Show all ${numberFormatter.format(group.models.length)}`}
                          </Button>
                        </div>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </section>

        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="editorial-section-kicker">Embedding Routing</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Embeddings run through a fixed local Ollama route
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Knowledge indexing, graph extraction, and semantic retrieval now always
                  use the local Ollama embedding model <code>qwen3-embedding:4b</code>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Hardcoded route</Badge>
                <Badge variant="outline">{HARDCODED_EMBEDDING_PROVIDER_NAME}</Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Effective route</Badge>
                <Badge variant="outline">{HARDCODED_EMBEDDING_PROVIDER_NAME}</Badge>
              </div>
              <p className="text-sm font-medium text-foreground">
                {effectiveEmbeddingSummary}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Base URL: {HARDCODED_EMBEDDING_BASE_URL}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Workspace embedding settings are ignored because this route is hardcoded
                in the server runtime.
              </p>
            </div>

            <Alert>
              <BrainCircuit className="h-4 w-4" />
              <AlertTitle>What this affects</AlertTitle>
              <AlertDescription>
                Document chunking, knowledge graph embeddings, and semantic retrieval all
                use this local Ollama model.
              </AlertDescription>
            </Alert>
          </div>
        </section>
      </div>

      <ProviderFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setFormError(null)
          }
        }}
        mode={formMode}
        values={formValues}
        onValuesChange={setFormValues}
        onProviderTypeChange={handleProviderTypeChange}
        onSubmit={handleFormSubmit}
        error={formError}
        mutating={providerMutating}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AI provider?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be removed from this workspace and its models will disappear from the AI catalog.`
                : 'This provider will be removed from the workspace.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={providerMutating}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={providerMutating}
            >
              {providerMutating ? 'Deleting…' : 'Delete Provider'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
