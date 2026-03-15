'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Copy, Check, RefreshCw, Server, Zap, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface MockConfig {
  id: string
  enabled: boolean
  delay: number
  errorRate: number
  seed: number | null
  overrides: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface RequestLog {
  id: string
  method: string
  path: string
  statusCode: number
  duration: number
  createdAt: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PATCH: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  DELETE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

function statusColor(code: number) {
  if (code < 300) return 'text-emerald-600 dark:text-emerald-400'
  if (code < 400) return 'text-blue-600 dark:text-blue-400'
  if (code < 500) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

export function MockServerPanel({ openapiSourceId }: { openapiSourceId: string }) {
  const [config, setConfig] = useState<MockConfig | null>(null)
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [delay, setDelay] = useState(0)
  const [errorRate, setErrorRate] = useState(0)
  const [seed, setSeed] = useState('')

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/mock-servers')
      if (!res.ok) throw new Error()
      const configs: MockConfig[] = await res.json()
      const existing = configs.find(
        (c: MockConfig & { openapiSourceId?: string }) => c.openapiSourceId === openapiSourceId,
      )
      if (existing) {
        const detailRes = await fetch(`/api/mock-servers/${existing.id}`)
        if (detailRes.ok) {
          const data = await detailRes.json()
          setConfig(data)
          setLogs(data.logs ?? [])
          setDelay(data.delay)
          setErrorRate(data.errorRate)
          setSeed(data.seed?.toString() ?? '')
        }
      } else {
        setConfig(null)
        setLogs([])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [openapiSourceId])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const createConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/mock-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openapiSourceId }),
      })
      if (!res.ok) throw new Error()
      toast.success('Mock server created')
      await fetchConfig()
    } catch {
      toast.error('Failed to create mock server')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = async (updates: Partial<MockConfig>) => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch(`/api/mock-servers/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setConfig((prev) => (prev ? { ...prev, ...updated } : prev))
      toast.success('Configuration saved')
    } catch {
      toast.error('Failed to update configuration')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = () => {
    if (!config) return
    updateConfig({ enabled: !config.enabled })
  }

  const saveSettings = () => {
    updateConfig({
      delay,
      errorRate,
      seed: seed.trim() ? parseInt(seed, 10) : null,
    } as Partial<MockConfig> & { seed: number | null })
  }

  const copyUrl = () => {
    if (!config) return
    const url = `${window.location.origin}/api/mock/${config.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Mock URL copied')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!config) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Server className="mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No mock server configured</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Create a mock server to auto-generate API responses from your OpenAPI spec.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={createConfig}
            disabled={saving}
          >
            {saving && <RefreshCw className="mr-1.5 size-3.5 animate-spin" />}
            <Zap className="mr-1.5 size-3.5" />
            Enable Mock Server
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status & URL */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm font-medium">Mock Server</CardTitle>
              <Badge
                variant={config.enabled ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {config.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="mock-toggle" className="text-xs text-muted-foreground">
                {config.enabled ? 'On' : 'Off'}
              </Label>
              <Switch
                id="mock-toggle"
                checked={config.enabled}
                onCheckedChange={toggleEnabled}
              />
            </div>
          </div>
          <CardDescription className="text-xs">
            Auto-generated API responses from your OpenAPI specification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div>
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Base URL
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-1.5 font-mono text-xs">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/api/mock/${config.id}`
                  : `/api/mock/${config.id}`}
              </code>
              <Button variant="outline" size="sm" onClick={copyUrl} className="shrink-0">
                {copied ? (
                  <Check className="mr-1.5 size-3.5" />
                ) : (
                  <Copy className="mr-1.5 size-3.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Response Delay</Label>
              <span className="font-mono text-xs text-muted-foreground">{delay}ms</span>
            </div>
            <Slider
              value={[delay]}
              onValueChange={([v]) => setDelay(v)}
              min={0}
              max={5000}
              step={100}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <AlertTriangle className="size-3 text-amber-500" />
                Error Rate
              </Label>
              <span className="font-mono text-xs text-muted-foreground">
                {Math.round(errorRate * 100)}%
              </span>
            </div>
            <Slider
              value={[errorRate * 100]}
              onValueChange={([v]) => setErrorRate(v / 100)}
              min={0}
              max={100}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seed-input" className="text-xs">
              Random Seed
            </Label>
            <Input
              id="seed-input"
              type="number"
              placeholder="Leave empty for random"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="h-8 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Set a fixed seed for deterministic mock responses.
            </p>
          </div>

          <Button size="sm" onClick={saveSettings} disabled={saving}>
            {saving && <RefreshCw className="mr-1.5 size-3.5 animate-spin" />}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Request Logs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Requests</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchConfig} className="h-7 text-xs">
              <RefreshCw className="mr-1.5 size-3" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {logs.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No requests yet. Send a request to{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                /api/mock/{config.id}/...
              </code>
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[72px] text-[11px]">Method</TableHead>
                    <TableHead className="text-[11px]">Path</TableHead>
                    <TableHead className="w-[64px] text-[11px]">Status</TableHead>
                    <TableHead className="w-[72px] text-right text-[11px]">Duration</TableHead>
                    <TableHead className="w-[100px] text-right text-[11px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="py-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-mono ${METHOD_COLORS[log.method] ?? ''}`}
                        >
                          {log.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 font-mono text-xs">
                        {log.path}
                      </TableCell>
                      <TableCell className={`py-1.5 font-mono text-xs font-medium ${statusColor(log.statusCode)}`}>
                        {log.statusCode}
                      </TableCell>
                      <TableCell className="py-1.5 text-right font-mono text-xs text-muted-foreground">
                        {log.duration}ms
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
