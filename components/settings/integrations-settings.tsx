'use client'

import * as React from 'react'
import {
  Github,
  Loader2,
  MessageSquare,
  Plug,
  Plus,
  Send,
  SquareKanban,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

type Provider = 'slack' | 'github' | 'jira'

interface Integration {
  id: string
  provider: Provider
  displayName: string
  config: Record<string, unknown>
  events: string[]
  status: 'connected' | 'disconnected' | 'error'
  statusMessage: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface LogEntry {
  id: string
  event: string
  direction: string
  status: string
  errorMessage: string | null
  createdAt: string
}

const PROVIDER_META: Record<
  Provider,
  { label: string; icon: React.ElementType; description: string; color: string }
> = {
  slack: {
    label: 'Slack',
    icon: MessageSquare,
    description: 'Send notifications to Slack channels',
    color: 'text-amber-600 dark:text-amber-400',
  },
  github: {
    label: 'GitHub',
    icon: Github,
    description: 'Sync docs with GitHub repos',
    color: 'text-foreground',
  },
  jira: {
    label: 'Jira',
    icon: SquareKanban,
    description: 'Create Jira tickets from approvals',
    color: 'text-blue-600 dark:text-blue-400',
  },
}

const EVENT_OPTIONS = [
  { value: 'document.published', label: 'Document published' },
  { value: 'comment.created', label: 'Comment created' },
  { value: 'approval.requested', label: 'Approval requested' },
  { value: 'approval.decided', label: 'Approval decided' },
  { value: 'openapi.updated', label: 'OpenAPI updated' },
] as const

const PROVIDER_EVENTS: Record<Provider, string[]> = {
  slack: ['document.published', 'comment.created', 'approval.requested', 'approval.decided'],
  github: ['document.published', 'approval.requested', 'openapi.updated'],
  jira: ['approval.requested', 'document.published'],
}

function statusBadge(status: Integration['status']) {
  switch (status) {
    case 'connected':
      return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Connected</Badge>
    case 'error':
      return <Badge variant="secondary" className="bg-destructive/10 text-destructive">Error</Badge>
    case 'disconnected':
      return <Badge variant="secondary">Disconnected</Badge>
  }
}

export function IntegrationsSettings({
  workspaceId: _workspaceId,
}: {
  workspaceId: string
}) {
  const [integrations, setIntegrations] = React.useState<Integration[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [dialogProvider, setDialogProvider] = React.useState<Provider | null>(null)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)
  const [testingId, setTestingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [logs, setLogs] = React.useState<Record<string, LogEntry[]>>({})

  const fetchIntegrations = React.useCallback(async () => {
    try {
      const res = await fetch('/api/integrations')
      if (res.ok) setIntegrations(await res.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchIntegrations()
  }, [fetchIntegrations])

  const fetchLogs = React.useCallback(async (integrationId: string) => {
    try {
      const res = await fetch(`/api/integrations/${integrationId}/logs?limit=10`)
      if (res.ok) {
        const data = await res.json()
        setLogs((prev) => ({ ...prev, [integrationId]: data }))
      }
    } catch {
      // silent
    }
  }, [])

  const handleExpand = React.useCallback(
    (id: string) => {
      const next = expandedId === id ? null : id
      setExpandedId(next)
      if (next) void fetchLogs(next)
    },
    [expandedId, fetchLogs],
  )

  const handleToggle = React.useCallback(
    async (integration: Integration, enabled: boolean) => {
      setTogglingId(integration.id)
      const prev = integrations
      setIntegrations((items) =>
        items.map((i) => (i.id === integration.id ? { ...i, enabled } : i)),
      )
      try {
        const res = await fetch(`/api/integrations/${integration.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        })
        if (!res.ok) throw new Error()
      } catch {
        setIntegrations(prev)
        toast.error('Failed to update integration.')
      } finally {
        setTogglingId(null)
      }
    },
    [integrations],
  )

  const handleTest = React.useCallback(async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/integrations/${id}/test`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        toast.success('Test event sent successfully.')
        setIntegrations((items) =>
          items.map((i) =>
            i.id === id ? { ...i, status: 'connected' as const, statusMessage: null } : i,
          ),
        )
        void fetchLogs(id)
      } else {
        toast.error(data?.error ?? 'Test failed.')
      }
    } catch {
      toast.error('Failed to send test event.')
    } finally {
      setTestingId(null)
    }
  }, [fetchLogs])

  const handleDelete = React.useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/integrations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setIntegrations((items) => items.filter((i) => i.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success('Integration removed.')
    } catch {
      toast.error('Failed to remove integration.')
    } finally {
      setDeletingId(null)
    }
  }, [expandedId])

  const handleCreated = React.useCallback((integration: Integration) => {
    setIntegrations((items) => [integration, ...items])
    setDialogProvider(null)
  }, [])

  const connectedProviders = new Set(integrations.map((i) => i.provider))

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Provider cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(PROVIDER_META) as Provider[]).map((provider) => {
          const meta = PROVIDER_META[provider]
          const Icon = meta.icon
          const connected = connectedProviders.has(provider)

          return (
            <Card key={provider} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60">
                    <Icon className={`size-5 ${meta.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{meta.label}</CardTitle>
                    <CardDescription className="text-xs">
                      {meta.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {connected ? (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                    Connected
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogProvider(provider)}
                  >
                    <Plus className="size-3.5" />
                    Connect
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Connected integrations list */}
      {integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active integrations</CardTitle>
            <CardDescription>
              Manage connected services and view recent activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {integrations.map((integration) => {
              const meta = PROVIDER_META[integration.provider]
              const Icon = meta.icon
              const expanded = expandedId === integration.id
              const integrationLogs = logs[integration.id] ?? []

              return (
                <div
                  key={integration.id}
                  className="rounded-md border border-border/70 bg-muted/20"
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 p-4 text-left"
                    onClick={() => handleExpand(integration.id)}
                  >
                    <Icon className={`mt-0.5 size-4 shrink-0 ${meta.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {integration.displayName}
                        </span>
                        {statusBadge(integration.status)}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(integration.events as string[]).join(', ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={(enabled) =>
                          void handleToggle(integration, enabled)
                        }
                        disabled={togglingId === integration.id}
                      />
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-border/50 px-4 pb-4 pt-3">
                      <div className="flex flex-col gap-4">
                        {/* Config summary */}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Configuration
                          </span>
                          <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground font-mono">
                            {integration.provider === 'slack' && (
                              <span>Webhook: {maskValue((integration.config as Record<string, string>).webhookUrl)}</span>
                            )}
                            {integration.provider === 'github' && (
                              <span>
                                {(integration.config as Record<string, string>).owner}/
                                {(integration.config as Record<string, string>).repo}
                              </span>
                            )}
                            {integration.provider === 'jira' && (
                              <span>
                                {(integration.config as Record<string, string>).siteUrl} · {(integration.config as Record<string, string>).projectKey}
                              </span>
                            )}
                          </div>
                        </div>

                        {integration.status === 'error' && integration.statusMessage && (
                          <div className="rounded-md bg-destructive/5 p-3 text-xs text-destructive">
                            {integration.statusMessage}
                          </div>
                        )}

                        {/* Recent logs */}
                        {integrationLogs.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Recent activity
                            </span>
                            <div className="flex flex-col gap-1">
                              {integrationLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="flex items-center gap-2 text-xs text-muted-foreground"
                                >
                                  <span
                                    className={`size-1.5 rounded-full ${
                                      log.status === 'success'
                                        ? 'bg-emerald-500'
                                        : 'bg-destructive'
                                    }`}
                                  />
                                  <span className="font-mono">{log.event}</span>
                                  <span className="text-muted-foreground/60">
                                    {formatRelative(log.createdAt)}
                                  </span>
                                  {log.errorMessage && (
                                    <span className="truncate text-destructive">
                                      {log.errorMessage}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleTest(integration.id)}
                            disabled={testingId === integration.id || !integration.enabled}
                          >
                            {testingId === integration.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Send className="size-3.5" />
                            )}
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDelete(integration.id)}
                            disabled={deletingId === integration.id}
                            className="text-muted-foreground hover:border-destructive hover:text-destructive"
                          >
                            {deletingId === integration.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {integrations.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <Plug className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No integrations connected yet. Choose a service above to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add integration dialog */}
      <Dialog
        open={dialogProvider !== null}
        onOpenChange={(open) => {
          if (!open) setDialogProvider(null)
        }}
      >
        <DialogContent>
          {dialogProvider && (
            <AddIntegrationForm
              provider={dialogProvider}
              onCreated={handleCreated}
              onCancel={() => setDialogProvider(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddIntegrationForm({
  provider,
  onCreated,
  onCancel,
}: {
  provider: Provider
  onCreated: (integration: Integration) => void
  onCancel: () => void
}) {
  const meta = PROVIDER_META[provider]
  const Icon = meta.icon
  const availableEvents = PROVIDER_EVENTS[provider]

  const [displayName, setDisplayName] = React.useState('')
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>(availableEvents)
  const [submitting, setSubmitting] = React.useState(false)

  // Slack fields
  const [webhookUrl, setWebhookUrl] = React.useState('')

  // GitHub fields
  const [accessToken, setAccessToken] = React.useState('')
  const [owner, setOwner] = React.useState('')
  const [repo, setRepo] = React.useState('')

  // Jira fields
  const [siteUrl, setSiteUrl] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [apiToken, setApiToken] = React.useState('')
  const [projectKey, setProjectKey] = React.useState('')

  const toggleEvent = React.useCallback((value: string) => {
    setSelectedEvents((prev) =>
      prev.includes(value)
        ? prev.filter((e) => e !== value)
        : [...prev, value],
    )
  }, [])

  const buildConfig = React.useCallback((): Record<string, string> => {
    switch (provider) {
      case 'slack':
        return { webhookUrl }
      case 'github':
        return { accessToken, owner, repo }
      case 'jira':
        return { siteUrl, email, apiToken, projectKey }
    }
  }, [provider, webhookUrl, accessToken, owner, repo, siteUrl, email, apiToken, projectKey])

  const isValid = React.useMemo(() => {
    if (!displayName.trim() || selectedEvents.length === 0) return false
    switch (provider) {
      case 'slack':
        return webhookUrl.startsWith('https://')
      case 'github':
        return accessToken.length > 0 && owner.length > 0 && repo.length > 0
      case 'jira':
        return siteUrl.startsWith('https://') && email.includes('@') && apiToken.length > 0 && projectKey.length > 0
    }
  }, [provider, displayName, selectedEvents, webhookUrl, accessToken, owner, repo, siteUrl, email, apiToken, projectKey])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitting(true)

      try {
        const res = await fetch('/api/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            displayName: displayName.trim(),
            config: buildConfig(),
            events: selectedEvents,
          }),
        })

        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(
            typeof data?.error === 'string' ? data.error : 'Failed to create integration',
          )
        }

        toast.success(`${meta.label} integration connected.`)
        onCreated(data)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to connect integration.',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [provider, displayName, buildConfig, selectedEvents, meta.label, onCreated],
  )

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Icon className={`size-5 ${meta.color}`} />
          Connect {meta.label}
        </DialogTitle>
        <DialogDescription>{meta.description}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="integration-name">Display name</Label>
          <Input
            id="integration-name"
            placeholder={`e.g. ${provider === 'slack' ? '#api-updates' : provider === 'github' ? 'docs-repo' : 'API project'}`}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
          />
        </div>

        {provider === 'slack' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="slack-webhook">Webhook URL</Label>
            <Input
              id="slack-webhook"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Create an incoming webhook in your Slack workspace settings.
            </p>
          </div>
        )}

        {provider === 'github' && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="github-token">Personal access token</Label>
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="github-owner">Owner</Label>
                <Input
                  id="github-owner"
                  placeholder="org-or-user"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="github-repo">Repository</Label>
                <Input
                  id="github-repo"
                  placeholder="repo-name"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {provider === 'jira' && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="jira-site">Site URL</Label>
              <Input
                id="jira-site"
                type="url"
                placeholder="https://your-domain.atlassian.net"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="jira-email">Email</Label>
                <Input
                  id="jira-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="jira-project">Project key</Label>
                <Input
                  id="jira-project"
                  placeholder="PROJ"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="jira-token">API token</Label>
              <Input
                id="jira-token"
                type="password"
                placeholder="Your Jira API token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2">
          <Label>Event subscriptions</Label>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_OPTIONS.filter((opt) => availableEvents.includes(opt.value)).map(
              (opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedEvents.includes(opt.value)}
                    onCheckedChange={() => toggleEvent(opt.value)}
                  />
                  {opt.label}
                </label>
              ),
            )}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Connect
        </Button>
      </DialogFooter>
    </form>
  )
}

function maskValue(value: string | undefined): string {
  if (!value) return '—'
  if (value.length <= 12) return '••••••••'
  return value.slice(0, 8) + '••••' + value.slice(-4)
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
