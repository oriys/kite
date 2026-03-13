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
  owner: { label: 'Owner', icon: Crown, color: 'text-amber-600 dark:text-amber-400' },
  admin: { label: 'Admin', icon: ShieldAlert, color: 'text-blue-600 dark:text-blue-400' },
  member: { label: 'Member', icon: Shield, color: 'text-foreground' },
  guest: { label: 'Guest', icon: User, color: 'text-muted-foreground' },
}

function useWorkspaceId() {
  const [workspaceId, setWorkspaceId] = React.useState<string | null>(null)
  React.useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => r.json())
      .then((ws: { id: string }[]) => {
        if (ws[0]) setWorkspaceId(ws[0].id)
      })
  }, [])
  return workspaceId
}

export default function MembersPage() {
  const workspaceId = useWorkspaceId()
  const [members, setMembers] = React.useState<Member[]>([])
  const [invites, setInvites] = React.useState<Invite[]>([])
  const [membersLoading, setMembersLoading] = React.useState(true)
  const [invitesLoading, setInvitesLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const hasLoadedMembersRef = React.useRef(false)

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
    if (!workspaceId) return
    setInvitesLoading(true)
    const res = await fetch(`/api/workspaces/${workspaceId}/invites`)
    if (res.ok) setInvites(await res.json())
    setInvitesLoading(false)
  }, [workspaceId])

  React.useEffect(() => {
    if (!workspaceId) return
    void fetchInvites()
  }, [workspaceId, fetchInvites])

  React.useEffect(() => {
    if (!workspaceId) return
    void fetchMembers()
  }, [workspaceId, fetchMembers])

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

  const handleRemove = async (userId: string, name: string | null) => {
    if (!workspaceId) return
    if (!confirm(`Remove ${name ?? 'this member'} from workspace?`)) return
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

  if (membersLoading || invitesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who has access to this workspace and their roles.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {workspaceId && (
          <InviteDialog
            workspaceId={workspaceId}
            onSuccess={() => fetchInvites()}
          />
        )}
      </div>

      {/* Members list */}
      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1fr_120px_120px_40px] items-center gap-4 border-b border-border px-4 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Member
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Role
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Joined
          </span>
          <span />
        </div>

        {members.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {search ? 'No members found.' : 'No members yet.'}
          </div>
        )}

        {members.map((member) => {
          const initials = (member.name ?? member.email ?? '?')
            .split(/[\s@]/)
            .map((s) => s[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()

          return (
            <div
              key={member.userId}
              className="grid grid-cols-[1fr_120px_120px_40px] items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={member.image ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.name ?? 'Unnamed'}
                    {member.status === 'disabled' && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Disabled
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
              </div>

              <div>
                <Select
                  value={member.role}
                  onValueChange={(v) =>
                    handleRoleChange(member.userId, v as MemberRole)
                  }
                  disabled={member.role === 'owner'}
                >
                  <SelectTrigger className="h-7 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_META).map(([key, m]) => (
                      <SelectItem key={key} value={key}>
                        <span className={cn('flex items-center gap-1.5', m.color)}>
                          <m.icon className="h-3 w-3" />
                          {m.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-xs text-muted-foreground">
                {new Date(member.joinedAt).toLocaleDateString()}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={member.role === 'owner'}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleRemove(member.userId, member.name)}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">
            Pending invites
            <Badge variant="secondary" className="ml-2">
              {invites.length}
            </Badge>
          </h2>
          <div className="rounded-lg border border-border bg-card">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between border-b border-border/50 px-4 py-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {invite.type === 'email' ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {invite.email ?? 'Invite link'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_META[invite.role].label} · Expires{' '}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleRevokeInvite(invite.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
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
        <Button size="sm">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to workspace</DialogTitle>
          <DialogDescription>
            Add new members by email or generate a shareable invite link.
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
              <Mail className="mr-1.5 h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1">
              <Link2 className="mr-1.5 h-4 w-4" />
              Link
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as MemberRole)}
              >
                <SelectTrigger>
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
                <Label>Email address</Label>
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="link" className="mt-0">
              {linkToken && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
                  <code className="flex-1 truncate text-xs">{linkToken}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={copyLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button onClick={handleInvite} disabled={loading || (tab === 'email' && !email)}>
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
