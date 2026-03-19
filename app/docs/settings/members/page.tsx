'use client'

import * as React from 'react'
import {
  Search,
  UserPlus,
  Copy,
  Check,
  Link2,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldAlert,
  Crown,
  User,
  UserX,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useSettingsAccess } from '@/components/settings/settings-access-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

type MemberRole = 'owner' | 'admin' | 'member' | 'guest'

interface Member {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: MemberRole
  status: 'active' | 'disabled'
  joinedAt: string
  invitedBy: string | null
}

interface Invite {
  id: string
  email: string | null
  role: MemberRole
  token: string
  type: 'email' | 'link'
  inviterName: string | null
  expiresAt: string
  createdAt: string
}

const ROLE_META: Record<MemberRole, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: 'Owner', icon: Crown, color: 'text-tone-caution-text' },
  admin: { label: 'Admin', icon: ShieldAlert, color: 'text-tone-info-text' },
  member: { label: 'Member', icon: Shield, color: 'text-foreground' },
  guest: { label: 'Guest', icon: User, color: 'text-muted-foreground' },
}

function getInviteUrl(token: string, origin: string) {
  return `${origin || ''}/invite/${token}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getInitials(value: string | null) {
  return (value ?? '?')
    .split(/[\s@]/)
    .map((segment) => segment[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function MembersPage() {
  const { workspaceId, currentRole } = useSettingsAccess()
  const canManageMembers = currentRole === 'admin' || currentRole === 'owner'
  const [members, setMembers] = React.useState<Member[]>([])
  const [invites, setInvites] = React.useState<Invite[]>([])
  const [membersLoading, setMembersLoading] = React.useState(true)
  const [invitesLoading, setInvitesLoading] = React.useState(canManageMembers)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [origin, setOrigin] = React.useState('')
  const [copiedInviteId, setCopiedInviteId] = React.useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = React.useState<{
    userId: string
    name: string | null
  } | null>(null)
  const hasLoadedMembersRef = React.useRef(false)

  React.useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [search])

  const fetchMembers = React.useCallback(async () => {
    if (!workspaceId) return
    if (!hasLoadedMembersRef.current) {
      setMembersLoading(true)
    }
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members${params.size ? `?${params.toString()}` : ''}`,
      )
      if (res.ok) {
        setMembers(await res.json())
      }
    } finally {
      hasLoadedMembersRef.current = true
      setMembersLoading(false)
    }
  }, [workspaceId, debouncedSearch])

  const fetchInvites = React.useCallback(async () => {
    if (!canManageMembers) {
      setInvites([])
      setInvitesLoading(false)
      return
    }

    setInvitesLoading(true)
    const res = await fetch(`/api/workspaces/${workspaceId}/invites`)
    if (res.ok) setInvites(await res.json())
    setInvitesLoading(false)
  }, [canManageMembers, workspaceId])

  React.useEffect(() => {
    void fetchInvites()
  }, [fetchInvites])

  React.useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const handleRoleChange = async (userId: string, role: MemberRole) => {
    if (!workspaceId) return
    const res = await fetch(
      `/api/workspaces/${workspaceId}/members/${userId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      },
    )
    if (res.ok) {
      toast.success('Role updated')
      fetchMembers()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to update role')
    }
  }

  const handleRemove = async (userId: string) => {
    if (!workspaceId) return
    const res = await fetch(
      `/api/workspaces/${workspaceId}/members/${userId}`,
      { method: 'DELETE' },
    )
    if (res.ok) {
      toast.success('Member removed')
      fetchMembers()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to remove member')
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!workspaceId) return
    const res = await fetch(
      `/api/workspaces/${workspaceId}/invites/${inviteId}`,
      { method: 'DELETE' },
    )
    if (res.ok) {
      toast.success('Invite revoked')
      fetchInvites()
    } else {
      toast.error('Failed to revoke invite')
    }
  }

  const handleCopyInviteLink = async (inviteId: string, token: string) => {
    try {
      await navigator.clipboard.writeText(getInviteUrl(token, origin))
      setCopiedInviteId(inviteId)
      window.setTimeout(() => {
        setCopiedInviteId((current) => (current === inviteId ? null : current))
      }, 2000)
      toast.success('Invite link copied')
    } catch {
      toast.error('Failed to copy invite link')
    }
  }

  if (membersLoading || (canManageMembers && invitesLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Members</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage workspace access and roles.
          </p>
        </div>
        {canManageMembers && (
          <InviteDialog workspaceId={workspaceId} onSuccess={() => fetchInvites()} />
        )}
      </div>

      {!canManageMembers ? (
        <Alert className="mb-6 border-border/60">
          <ShieldAlert className="size-4" />
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription className="text-xs">
            Only admins and owners can invite, change roles, or remove members.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Search */}
      <div className="mb-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded-md border-border/60 bg-background pl-8 text-sm shadow-none"
          />
        </div>
      </div>

      {/* Members table */}
      <div className="overflow-hidden rounded-lg border border-border/60">
        {/* Table header */}
        <div
          className={cn(
            'hidden items-center gap-4 border-b border-border/60 bg-muted/30 px-4 py-2 md:grid',
            canManageMembers
              ? 'grid-cols-[minmax(0,2fr)_140px_100px_32px]'
              : 'grid-cols-[minmax(0,2fr)_140px_100px]',
          )}
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Member
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Role
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Joined
          </span>
          {canManageMembers ? <span /> : null}
        </div>

        {members.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {search ? 'No members found.' : 'No members yet.'}
          </div>
        )}

        {members.map((member) => {
          const initials = getInitials(member.name ?? member.email)
          const roleMeta = ROLE_META[member.role]
          const RoleIcon = roleMeta.icon

          return (
            <div
              key={member.userId}
              className={cn(
                'grid gap-4 border-b border-border/40 px-4 py-3 last:border-0 md:items-center',
                canManageMembers
                  ? 'md:grid-cols-[minmax(0,2fr)_140px_100px_32px]'
                  : 'md:grid-cols-[minmax(0,2fr)_140px_100px]',
              )}
            >
              {/* Member info */}
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="size-8 shrink-0 border border-border/60">
                  <AvatarImage src={member.image ?? undefined} />
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {member.name ?? 'Unnamed'}
                    </p>
                    {member.status === 'disabled' && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
              </div>

              {/* Role */}
              {canManageMembers ? (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:hidden">
                    Role
                  </p>
                  {member.role === 'owner' ? (
                    <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 text-xs font-medium text-foreground">
                      <RoleIcon className={cn('size-3.5', roleMeta.color)} />
                      {roleMeta.label}
                    </div>
                  ) : (
                    <Select
                      value={member.role}
                      onValueChange={(v) =>
                        handleRoleChange(member.userId, v as MemberRole)
                      }
                    >
                      <SelectTrigger className="h-8 w-full rounded-md border-border/60 bg-background px-2.5 text-xs font-medium shadow-none sm:w-[140px]">
                        <SelectValue aria-label={roleMeta.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_META).map(([key, m]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-1.5">
                              <m.icon className={cn('size-3.5', m.color)} />
                              {m.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:hidden">
                    Role
                  </p>
                  <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium', roleMeta.color)}>
                    <RoleIcon className="size-3.5" />
                    {roleMeta.label}
                  </div>
                </div>
              )}

              {/* Joined */}
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:hidden">
                  Joined
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatDate(member.joinedAt)}
                </span>
              </div>

              {/* Actions */}
              {canManageMembers ? (
                <div className="flex items-center md:justify-end">
                  {member.role !== 'owner' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            setRemoveTarget({
                              userId: member.userId,
                              name: member.name,
                            })
                          }
                        >
                          <UserX className="mr-1.5 size-3.5" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Pending invites */}
      {canManageMembers && invites.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              Pending invites
              <span className="ml-2 text-xs text-muted-foreground">({invites.length})</span>
            </h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-border/60">
            {invites.map((invite, idx) => (
              <div
                key={invite.id}
                className={cn(
                  'flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                  idx < invites.length - 1 && 'border-b border-border/40',
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    {invite.type === 'email' ? (
                      <Mail className="size-3.5" />
                    ) : (
                      <Link2 className="size-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {invite.type === 'link' ? 'Share link' : invite.email ?? 'Invite'}
                      </p>
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-medium',
                        ROLE_META[invite.role].color,
                      )}>
                        {ROLE_META[invite.role].label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(invite.expiresAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {invite.type === 'link' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleCopyInviteLink(invite.id, invite.token)}
                    >
                      {copiedInviteId === invite.id ? (
                        <Check className="mr-1 size-3 text-tone-success-text" />
                      ) : (
                        <Copy className="mr-1 size-3" />
                      )}
                      {copiedInviteId === invite.id ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleRevokeInvite(invite.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null)
          }
        }}
        title="Remove member?"
        description={
          removeTarget
            ? `${removeTarget.name ?? 'This member'} will lose access to this workspace immediately.`
            : 'This member will lose access to this workspace immediately.'
        }
        actionLabel="Remove member"
        destructive
        onAction={() => {
          if (!removeTarget) return
          void handleRemove(removeTarget.userId)
        }}
      />
    </div>
  )
}

function InviteDialog({
  workspaceId,
  onSuccess,
}: {
  workspaceId: string
  onSuccess: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<'email' | 'link'>('email')
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<MemberRole>('member')
  const [loading, setLoading] = React.useState(false)
  const [linkToken, setLinkToken] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const handleInvite = async () => {
    setLoading(true)
    try {
      const body: Record<string, string> =
        tab === 'email'
          ? { type: 'email', email, role }
          : { type: 'link', role }

      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to create invite')
        return
      }

      const invite = await res.json()

      if (tab === 'email') {
        toast.success(`Invite sent to ${email}`)
        setEmail('')
        setOpen(false)
      } else {
        const url = `${window.location.origin}/invite/${invite.token}`
        setLinkToken(url)
      }
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!linkToken) return
    navigator.clipboard.writeText(linkToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setLinkToken(null)
          setCopied(false)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="h-8">
          <UserPlus className="mr-1.5 size-3.5" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to workspace</DialogTitle>
          <DialogDescription>
            Add members by email or generate a shareable link.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as 'email' | 'link')
            setLinkToken(null)
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="email" className="flex-1">
              <Mail className="mr-1.5 size-3.5" />
              Email
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1">
              <Link2 className="mr-1.5 size-3.5" />
              Link
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as MemberRole)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="email" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Email address</Label>
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="link" className="mt-0">
              {linkToken && (
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
                  <code className="flex-1 truncate font-mono text-xs text-muted-foreground">{linkToken}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={copyLink}
                  >
                    {copied ? (
                      <Check className="size-3.5 text-tone-success-text" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button
            size="sm"
            onClick={handleInvite}
            disabled={loading || (tab === 'email' && !email)}
          >
            {loading
              ? 'Creating…'
              : tab === 'email'
                ? 'Send invite'
                : linkToken
                  ? 'Generate new link'
                  : 'Generate link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
