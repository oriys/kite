'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Bot,
  BrainCircuit,
  ExternalLink,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'

import {
  createDefaultAiProviderFormValues,
  formatAiContextWindow,
  getAiProviderDefaultBaseUrl,
  getAiProviderDocsUrl,
  type AiProviderConfigListItem,
  type AiProviderFormValues,
} from '@/lib/ai'
import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
import { useAiProviders } from '@/hooks/use-ai-providers'
import { cn } from '@/lib/utils'
import { DocsAdminShell } from '@/components/docs/docs-admin-shell'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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

function createProviderValues(
  provider: AiProviderConfigListItem | null,
): AiProviderFormValues {
  if (!provider) {
    return createDefaultAiProviderFormValues()
  }

  return {
    name: provider.name,
    providerType: provider.providerType,
    baseUrl: provider.baseUrl || getAiProviderDefaultBaseUrl(provider.providerType),
    apiKey: '',
    defaultModelId: provider.defaultModelId,
    enabled: provider.enabled,
  }
}

type ProviderCard = {
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

export function DocAiManagerPage() {
  const {
    items: aiModels,
    loading: aiModelsLoading,
    error: catalogError,
    configured,
    providers: catalogProviders,
    defaultModelId,
    enabledModelIds: initialEnabledModelIds,
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
  const [openProviderGroup, setOpenProviderGroup] = React.useState<string | null>(
    null,
  )
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

  React.useEffect(() => {
    if (providerGroups.length === 0) {
      setOpenProviderGroup(null)
      return
    }

    if (
      openProviderGroup &&
      providerGroups.some((group) => group.providerId === openProviderGroup)
    ) {
      return
    }

    setOpenProviderGroup(
      providerGroups.find((group) => group.activeGroupModel)?.providerId ??
        providerGroups.find((group) => group.enabledCountInGroup > 0)?.providerId ??
        providerGroups[0]?.providerId ??
        null,
    )
  }, [openProviderGroup, providerGroups])

  const activeLabel = activeModel?.label || activeModel?.id || 'Not selected'
  const enabledCount = numberFormatter.format(enabledModels.length)
  const totalCount = numberFormatter.format(aiModels.length)
  const providerCount = numberFormatter.format(providerCards.length)
  const visibleProviderCount = numberFormatter.format(providerGroups.length)
  const dbProviderCount = providerCards.filter(
    (provider) => provider.source === 'database',
  ).length

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
    setFormValues(createProviderValues(provider.editableConfig))
    setFormError(null)
    setFormOpen(true)
  }, [])

  const handleProviderToggle = React.useCallback(
    async (provider: ProviderCard, enabled: boolean) => {
      if (!provider.editableConfig) return

      try {
        await updateProvider(provider.id, {
          ...createProviderValues(provider.editableConfig),
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
    aiModelsLoading || providersLoading || providerMutating || savingModelSettings

  return (
    <DocsAdminShell
      kicker="AI Models"
      title="Manage AI providers and models"
      description="Connect multiple providers, sync their catalogs, and control which models the editor can route to."
      actions={(
        <div className="flex flex-wrap items-center gap-2">
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
      )}
      meta={(
        <>
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
        </>
      )}
      notice={(
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
      )}
    >
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
              {providerCards.map((provider) => (
                <article
                  key={provider.id}
                  className="rounded-xl border border-border/70 bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold tracking-tight text-foreground">
                          {provider.name}
                        </h3>
                        <Badge variant="outline">{provider.providerLabel}</Badge>
                        <Badge
                          variant={provider.enabled ? 'secondary' : 'outline'}
                        >
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
                            onClick={() => openEditDialog(provider)}
                          >
                            <PencilLine data-icon="inline-start" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(provider)}
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
                        onCheckedChange={(checked) =>
                          void handleProviderToggle(provider, checked)
                        }
                        aria-label={`Enable ${provider.name}`}
                        disabled={providerMutating}
                      />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
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
              <div className="flex items-center justify-between gap-3">
                <p className="editorial-section-kicker">Default AI</p>
                <Badge variant="outline">{enabledCount} enabled</Badge>
              </div>
              <Select
                value={activeModelId ?? undefined}
                onValueChange={(value) => setActiveModelId(value)}
                disabled={aiModels.length === 0}
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
              value={openProviderGroup ?? undefined}
              onValueChange={(value) => setOpenProviderGroup(value || null)}
              className="px-4 sm:px-5"
            >
              {providerGroups.map((group) => (
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
                      {group.models.map((model) => {
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
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </section>
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setFormError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle>
                {formMode === 'create' ? 'Add AI provider' : 'Edit AI provider'}
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
                      value={formValues.name}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Primary Anthropic"
                      aria-invalid={Boolean(formError && !formValues.name.trim())}
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
                      value={formValues.providerType}
                      onValueChange={handleProviderTypeChange}
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
                      value={formValues.baseUrl}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          baseUrl: event.target.value,
                        }))
                      }
                      placeholder={getAiProviderDefaultBaseUrl(formValues.providerType)}
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
                      value={formValues.apiKey}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          apiKey: event.target.value,
                        }))
                      }
                      placeholder={
                        formMode === 'edit'
                          ? 'Leave blank to keep the saved key'
                          : 'sk-...'
                      }
                    />
                    <FieldDescription>
                      {formMode === 'edit'
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
                      value={formValues.defaultModelId}
                      onChange={(event) =>
                        setFormValues((current) => ({
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
                        checked={formValues.enabled}
                        onCheckedChange={(checked) =>
                          setFormValues((current) => ({
                            ...current,
                            enabled: checked,
                          }))
                        }
                      />
                    </div>
                  </FieldContent>
                </Field>
              </FieldGroup>

              {formError ? (
                <p className="mt-4 text-sm text-destructive">{formError}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={providerMutating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={providerMutating}>
                {providerMutating
                  ? formMode === 'create'
                    ? 'Adding…'
                    : 'Saving…'
                  : formMode === 'create'
                    ? 'Add Provider'
                    : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
    </DocsAdminShell>
  )
}
