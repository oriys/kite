'use client'

import * as React from 'react'
import { Copy, Check, Plus, Trash2, AlertTriangle, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ApiToken {
  id: string
  name: string
  tokenPrefix: string
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

function formatDate(date: string | null) {
  if (!date) return 'Never'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export function ApiTokensSettings({ workspaceId: _workspaceId }: { workspaceId: string }) {
  const [tokens, setTokens] = React.useState<ApiToken[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [expiresAt, setExpiresAt] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [newToken, setNewToken] = React.useState<string | null>(null)
  const [hasCopied, setHasCopied] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const fetchTokens = React.useCallback(async () => {
    try {
      const res = await fetch('/api/tokens')
      if (res.ok) setTokens(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchTokens() }, [fetchTokens])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), expiresAt: expiresAt || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        setNewToken(data.token)
        setName('')
        setExpiresAt('')
        fetchTokens()
        toast.success('Token created')
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to create token')
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTokens((prev) => prev.filter((t) => t.id !== id))
        toast.success('Token deleted')
      } else {
        toast.error('Failed to delete token')
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopy = () => {
    if (!newToken) return
    navigator.clipboard.writeText(newToken)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setNewToken(null)
      setName('')
      setExpiresAt('')
      setHasCopied(false)
    }
    setCreateOpen(open)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">API Tokens</h1>
          <p className="text-sm text-muted-foreground">
            Manage tokens for CLI and CI/CD pipeline access.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              Create Token
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            {newToken ? (
              <>
                <DialogHeader>
                  <DialogTitle>Token Created</DialogTitle>
                  <DialogDescription>
                    Copy your token now. It won&apos;t be shown again.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                    <code className="flex-1 break-all text-xs font-mono">{newToken}</code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0"
                      onClick={handleCopy}
                    >
                      {hasCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>Store this token securely. You won&apos;t be able to see it again.</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleDialogClose(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Token</DialogTitle>
                  <DialogDescription>
                    Generate a token for CLI or CI/CD access.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g. CI Pipeline"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry date (optional)</Label>
                    <Input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                    {creating ? 'Creating…' : 'Create'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Active Tokens</CardTitle>
          <CardDescription>
            Tokens provide API access to your workspace. Revoke any token you no longer need.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <KeyRound className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No API tokens yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {tokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{token.name}</span>
                      {isExpired(token.expiresAt) && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Expired
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                        {token.tokenPrefix}…
                      </code>
                      <span>Created {formatDate(token.createdAt)}</span>
                      <span>Last used {formatDate(token.lastUsedAt)}</span>
                      {token.expiresAt && !isExpired(token.expiresAt) && (
                        <span>Expires {formatDate(token.expiresAt)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(token.id)}
                    disabled={deletingId === token.id}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
