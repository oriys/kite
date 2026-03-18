'use client'

import * as React from 'react'
import {
  Plus,
  Trash2,
  Pencil,
  Shield,
  ShieldAlert,
  KeyRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'

interface SsoConfig {
  id: string
  workspaceId: string
  provider: 'oidc' | 'saml'
  displayName: string
  issuerUrl: string | null
  clientId: string | null
  clientSecret: string | null
  defaultRole: string
  autoProvision: boolean
  enforced: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

type FormData = {
  provider: 'oidc' | 'saml'
  displayName: string
  issuerUrl: string
  clientId: string
  clientSecret: string
  defaultRole: string
  autoProvision: boolean
  enforced: boolean
  enabled: boolean
}

const EMPTY_FORM: FormData = {
  provider: 'oidc',
  displayName: '',
  issuerUrl: '',
  clientId: '',
  clientSecret: '',
  defaultRole: 'member',
  autoProvision: true,
  enforced: false,
  enabled: true,
}

export function SsoSettings({ workspaceId }: { workspaceId: string }) {
  void workspaceId
  const [configs, setConfigs] = React.useState<SsoConfig[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string
    displayName: string
  } | null>(null)
  const [form, setForm] = React.useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)

  const fetchConfigs = React.useCallback(async () => {
    try {
      const res = await fetch('/api/sso/configs')
      if (res.ok) setConfigs(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(config: SsoConfig) {
    setEditingId(config.id)
    setForm({
      provider: config.provider,
      displayName: config.displayName,
      issuerUrl: config.issuerUrl ?? '',
      clientId: config.clientId ?? '',
      clientSecret: '',
      defaultRole: config.defaultRole,
      autoProvision: config.autoProvision,
      enforced: config.enforced,
      enabled: config.enabled,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        ...form,
        clientSecret: form.clientSecret || undefined,
      }

      if (editingId) {
        const res = await fetch(`/api/sso/configs/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update SSO configuration')
        toast.success('SSO configuration updated')
      } else {
        const res = await fetch('/api/sso/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create SSO configuration')
        toast.success('SSO configuration created')
      }
      setDialogOpen(false)
      fetchConfigs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/sso/configs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('SSO configuration deleted')
      fetchConfigs()
    } catch {
      toast.error('Failed to delete SSO configuration')
    }
  }

  async function handleToggleEnabled(config: SsoConfig) {
    try {
      const res = await fetch(`/api/sso/configs/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, enabled: !config.enabled }),
      })
      if (!res.ok) throw new Error('Failed to update')
      fetchConfigs()
    } catch {
      toast.error('Failed to update SSO configuration')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading SSO configurations…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Single Sign-On
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure enterprise identity providers for your workspace.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit SSO Configuration' : 'Add SSO Configuration'}
              </DialogTitle>
              <DialogDescription>
                Connect an identity provider to allow workspace members to sign
                in with SSO.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Provider Type</Label>
                <RadioGroup
                  value={form.provider}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, provider: v as 'oidc' | 'saml' }))
                  }
                  className="flex gap-4"
                  disabled={!!editingId}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="oidc" id="provider-oidc" />
                    <Label htmlFor="provider-oidc" className="font-normal">
                      OIDC
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="saml" id="provider-saml" />
                    <Label htmlFor="provider-saml" className="font-normal">
                      SAML
                    </Label>
                    <Badge variant="secondary" className="text-xs">
                      Coming Soon
                    </Badge>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="e.g. Okta, Azure AD"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                />
              </div>

              {form.provider === 'oidc' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="issuerUrl">Issuer URL</Label>
                    <Input
                      id="issuerUrl"
                      placeholder="https://accounts.google.com"
                      value={form.issuerUrl}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, issuerUrl: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      The OpenID Connect issuer URL from your identity provider.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      value={form.clientId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, clientId: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      placeholder={editingId ? '••••••••' : ''}
                      value={form.clientSecret}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          clientSecret: e.target.value,
                        }))
                      }
                    />
                    {editingId && (
                      <p className="text-xs text-muted-foreground">
                        Leave empty to keep the current secret.
                      </p>
                    )}
                  </div>
                </>
              )}

              {form.provider === 'saml' && (
                <div className="rounded-md border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    SAML support is coming soon
                  </p>
                  <p className="mt-1">
                    SAML configuration will be available in a future release.
                    Please use OIDC for now — most identity providers (Okta,
                    Azure AD, Google Workspace) support it.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="defaultRole">Default Role</Label>
                <Select
                  value={form.defaultRole}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, defaultRole: v }))
                  }
                >
                  <SelectTrigger id="defaultRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Role assigned to users provisioned through SSO.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-provision Users</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically add SSO users to this workspace.
                  </p>
                </div>
                <Switch
                  checked={form.autoProvision}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, autoProvision: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enforce SSO</Label>
                  <p className="text-xs text-muted-foreground">
                    Require SSO for all workspace members.
                  </p>
                </div>
                <Switch
                  checked={form.enforced}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, enforced: v }))
                  }
                />
              </div>

              {form.enforced && (
                <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-amber-800 dark:text-amber-200">
                    When enforced, members can only sign in via SSO. Social and
                    password logins will be disabled for this workspace.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.displayName ||
                  (form.provider === 'oidc' &&
                    (!form.issuerUrl || !form.clientId || (!form.clientSecret && !editingId)))
                }
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <KeyRound className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-medium">No SSO configured</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add an OIDC identity provider to enable single sign-on for your
              workspace members.
            </p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="size-4" />
              Add Configuration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {configs.map((config) => (
            <Card key={config.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {config.displayName}
                    </CardTitle>
                    <Badge
                      variant={
                        config.provider === 'oidc' ? 'default' : 'secondary'
                      }
                      className="text-xs uppercase"
                    >
                      {config.provider}
                    </Badge>
                    {config.enforced && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 text-xs text-amber-600 dark:text-amber-400"
                      >
                        <Shield className="mr-1 size-3" />
                        Enforced
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {config.issuerUrl ?? 'No issuer URL set'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={() => handleToggleEnabled(config)}
                    aria-label={`${config.enabled ? 'Disable' : 'Enable'} ${config.displayName}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openEdit(config)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() =>
                      setDeleteTarget({
                        id: config.id,
                        displayName: config.displayName,
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    Role:{' '}
                    <span className="font-medium text-foreground">
                      {config.defaultRole}
                    </span>
                  </span>
                  <span>
                    Auto-provision:{' '}
                    <span className="font-medium text-foreground">
                      {config.autoProvision ? 'Yes' : 'No'}
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title="Delete SSO configuration?"
        description={
          deleteTarget
            ? `“${deleteTarget.displayName}” will be removed, and users will no longer be able to sign in with this provider.`
            : 'This SSO configuration will be removed, and users will no longer be able to sign in with this provider.'
        }
        actionLabel="Delete configuration"
        destructive
        onAction={() => {
          if (!deleteTarget) return
          void handleDelete(deleteTarget.id)
        }}
      />
    </div>
  )
}
