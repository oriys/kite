'use client'

import * as React from 'react'
import {
  Bell,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Send,
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface NotificationChannel {
  id: string
  channelType: 'email' | 'slack_webhook'
  name: string
  config: Record<string, unknown>
  events: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const EVENT_OPTIONS = [
  { value: '*', label: 'All events' },
  { value: 'comment', label: 'Comments' },
  { value: 'mention', label: 'Mentions' },
  { value: 'approval_request', label: 'Approval requests' },
  { value: 'approval_decision', label: 'Approval decisions' },
  { value: 'status_change', label: 'Status changes' },
  { value: 'webhook_failure', label: 'Webhook failures' },
  { value: 'system', label: 'System' },
] as const

function ChannelTypeIcon({
  type,
  className,
}: {
  type: 'email' | 'slack_webhook'
  className?: string
}) {
  return type === 'email' ? (
    <Mail className={className} />
  ) : (
    <MessageSquare className={className} />
  )
}

function eventLabels(events: string[]): string {
  if (events.includes('*')) return 'All events'
  return events
    .map((e) => EVENT_OPTIONS.find((o) => o.value === e)?.label ?? e)
    .join(', ')
}

export function NotificationChannelsSettings(_props: {
  workspaceId: string
}) {
  const [channels, setChannels] = React.useState<NotificationChannel[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)
  const [testingId, setTestingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const fetchChannels = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notification-channels')
      if (res.ok) {
        setChannels(await res.json())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchChannels()
  }, [fetchChannels])

  const handleToggle = React.useCallback(
    async (channel: NotificationChannel, enabled: boolean) => {
      setTogglingId(channel.id)
      const prev = channels
      setChannels((chs) =>
        chs.map((c) => (c.id === channel.id ? { ...c, enabled } : c)),
      )

      try {
        const res = await fetch(`/api/notification-channels/${channel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        })
        if (!res.ok) throw new Error('Failed to update channel')
      } catch {
        setChannels(prev)
        toast.error('Failed to update channel.')
      } finally {
        setTogglingId(null)
      }
    },
    [channels],
  )

  const handleTest = React.useCallback(async (channelId: string) => {
    setTestingId(channelId)
    try {
      const res = await fetch(
        `/api/notification-channels/${channelId}/test`,
        { method: 'POST' },
      )
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        toast.success('Test notification sent.')
      } else {
        toast.error(data?.error ?? 'Test delivery failed.')
      }
    } catch {
      toast.error('Failed to send test notification.')
    } finally {
      setTestingId(null)
    }
  }, [])

  const handleDelete = React.useCallback(
    async (channelId: string) => {
      setDeletingId(channelId)
      try {
        const res = await fetch(`/api/notification-channels/${channelId}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error()
        setChannels((chs) => chs.filter((c) => c.id !== channelId))
        toast.success('Channel deleted.')
      } catch {
        toast.error('Failed to delete channel.')
      } finally {
        setDeletingId(null)
      }
    },
    [],
  )

  const handleCreated = React.useCallback(
    (channel: NotificationChannel) => {
      setChannels((chs) => [channel, ...chs])
      setDialogOpen(false)
    },
    [],
  )

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification channels</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification channels</CardTitle>
        <CardDescription>
          Forward workspace notifications to email or Slack. Only workspace
          admins can manage channels.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {channels.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border/70 py-8 text-center">
            <Bell className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No notification channels configured yet.
            </p>
          </div>
        )}

        {channels.map((channel) => (
          <div
            key={channel.id}
            className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/20 p-4"
          >
            <ChannelTypeIcon
              type={channel.channelType}
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {channel.name}
                </span>
                <Badge variant="secondary" className="text-[11px]">
                  {channel.channelType === 'email' ? 'Email' : 'Slack'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {eventLabels(channel.events as string[])}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleTest(channel.id)}
                disabled={testingId === channel.id || !channel.enabled}
              >
                {testingId === channel.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                <span className="sr-only">Test</span>
              </Button>
              <Switch
                checked={channel.enabled}
                onCheckedChange={(enabled) =>
                  void handleToggle(channel, enabled)
                }
                disabled={togglingId === channel.id}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDelete(channel.id)}
                disabled={deletingId === channel.id}
                className="text-muted-foreground hover:text-destructive"
              >
                {deletingId === channel.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        ))}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-fit">
              <Plus className="size-4" />
              Add channel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <AddChannelForm
              onCreated={handleCreated}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function AddChannelForm({
  onCreated,
  onCancel,
}: {
  onCreated: (channel: NotificationChannel) => void
  onCancel: () => void
}) {
  const [channelType, setChannelType] = React.useState<
    'email' | 'slack_webhook'
  >('email')
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [webhookUrl, setWebhookUrl] = React.useState('')
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>(['*'])
  const [submitting, setSubmitting] = React.useState(false)

  const toggleEvent = React.useCallback((value: string) => {
    setSelectedEvents((prev) => {
      if (value === '*') {
        return prev.includes('*') ? [] : ['*']
      }
      const without = prev.filter((e) => e !== '*' && e !== value)
      if (prev.includes(value)) return without
      return [...without, value]
    })
  }, [])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitting(true)

      const config =
        channelType === 'email' ? { email } : { webhookUrl }

      try {
        const res = await fetch('/api/notification-channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelType,
            name,
            config,
            events: selectedEvents,
          }),
        })

        const data = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(
            typeof data?.error === 'string' ? data.error : 'Failed to create channel',
          )
        }

        toast.success('Channel created.')
        onCreated(data)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to create channel.',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [channelType, name, email, webhookUrl, selectedEvents, onCreated],
  )

  const isValid =
    name.trim().length > 0 &&
    selectedEvents.length > 0 &&
    (channelType === 'email'
      ? email.includes('@')
      : webhookUrl.startsWith('https://'))

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <DialogHeader>
        <DialogTitle>Add notification channel</DialogTitle>
        <DialogDescription>
          Forward workspace notifications to an external destination.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="channel-type">Channel type</Label>
          <Select
            value={channelType}
            onValueChange={(v) =>
              setChannelType(v as 'email' | 'slack_webhook')
            }
          >
            <SelectTrigger id="channel-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5" />
                  Email
                </div>
              </SelectItem>
              <SelectItem value="slack_webhook">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-3.5" />
                  Slack Webhook
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="channel-name">Name</Label>
          <Input
            id="channel-name"
            placeholder={
              channelType === 'email'
                ? 'e.g. Engineering alerts'
                : 'e.g. #api-updates'
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>

        {channelType === 'email' ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-email">Email address</Label>
            <Input
              id="channel-email"
              type="email"
              placeholder="team@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-webhook-url">Webhook URL</Label>
            <Input
              id="channel-webhook-url"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Events</Label>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_OPTIONS.map((opt) => (
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
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Create channel
        </Button>
      </DialogFooter>
    </form>
  )
}
