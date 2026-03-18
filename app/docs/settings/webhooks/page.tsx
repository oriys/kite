'use client'

import * as React from 'react'
import {
  Webhook,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Play,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Spinner } from '@/components/ui/spinner'
import { Label } from '@/components/ui/label'

const EVENTS = [
  'document.created',
  'document.updated',
  'document.published',
  'document.archived',
  'document.deleted',
  'comment.created',
  'comment.resolved',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'api_version.created',
  'api_version.deprecated',
]

interface WebhookItem {
  id: string
  name: string
  url: string
  events: string[]
  isActive: boolean
  createdAt: string
}

export default function WebhooksSettingsPage() {
  const [webhooks, setWebhooks] = React.useState<WebhookItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>([])
  const [creating, setCreating] = React.useState(false)
  const [testingId, setTestingId] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    const res = await fetch('/api/webhooks')
    if (res.ok) setWebhooks(await res.json())
    setLoading(false)
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, events: selectedEvents }),
      })
      if (res.ok) {
        setCreateOpen(false)
        setName('')
        setUrl('')
        setSelectedEvents([])
        refresh()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/webhooks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    refresh()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
    refresh()
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' })
      if (res.ok) {
        toast.success('Test event sent successfully')
      } else {
        toast.error('Test event failed', {
          description: `Server responded with ${res.status}`,
        })
      }
    } catch {
      toast.error('Test event failed', {
        description: 'Could not reach the server',
      })
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Send real-time events to external services
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                We&apos;ll send POST requests with event payloads to your URL
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Slack Notifications"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payload URL</Label>
                <Input
                  placeholder="https://example.com/webhook"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedEvents.includes(event)}
                        onCheckedChange={(checked) =>
                          setSelectedEvents((prev) =>
                            checked
                              ? [...prev, event]
                              : prev.filter((e) => e !== event),
                          )
                        }
                      />
                      <code className="text-xs">{event}</code>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={creating || !name || !url}
              >
                {creating ? 'Creating…' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Spinner className="mx-auto size-5 text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Webhook className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No webhooks configured yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <Card key={wh.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{wh.name}</CardTitle>
                    <Badge
                      variant={wh.isActive ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {wh.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={testingId === wh.id}
                            onClick={() => handleTest(wh.id)}
                          >
                            {testingId === wh.id ? (
                              <Spinner className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send test event</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleToggle(wh.id, wh.isActive)}
                          >
                            {wh.isActive ? (
                              <ToggleRight className="h-3.5 w-3.5" />
                            ) : (
                              <ToggleLeft className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {wh.isActive ? 'Disable' : 'Enable'}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(wh.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete webhook</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <code className="text-xs text-muted-foreground">{wh.url}</code>
                {(wh.events as string[]).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(wh.events as string[]).map((e) => (
                      <Badge key={e} variant="outline" className="text-[10px]">
                        {e}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
