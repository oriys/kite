'use client'

import * as React from 'react'
import { Loader2, Search, Shield, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import type { Doc, DocPermissionAssignment, DocPermissionLevel } from '@/lib/documents'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type MemberRole = 'owner' | 'admin' | 'member' | 'guest'

interface WorkspaceMember {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: MemberRole
  status: 'active' | 'disabled'
  joinedAt: string
  invitedBy: string | null
}

const PERMISSION_LABELS: Record<DocPermissionLevel, string> = {
  view: 'View',
  edit: 'Edit',
  manage: 'Manage',
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
}

function getInitials(member: WorkspaceMember) {
  return (member.name ?? member.email ?? '?')
    .split(/[\s@]/)
    .map((segment) => segment[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function isLockedMember(document: Doc, member: WorkspaceMember) {
  if (member.status !== 'active') {
    return 'Disabled members cannot receive document permissions.'
  }
  if (document.createdBy === member.userId) {
    return 'The document creator always keeps manage access.'
  }
  if (member.role === 'owner' || member.role === 'admin') {
    return 'Workspace owners and admins always keep manage access.'
  }
  return null
}

function mergePermissionMap(assignments: DocPermissionAssignment[]) {
  return assignments.reduce<Record<string, DocPermissionLevel>>((acc, item) => {
    acc[item.userId] = item.level
    return acc
  }, {})
}

export function DocumentPermissionsDialog({
  document,
  className,
  onPermissionsChanged,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  document: Doc
  className?: string
  onPermissionsChanged?: () => void | Promise<void>
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [members, setMembers] = React.useState<WorkspaceMember[]>([])
  const [permissionMap, setPermissionMap] = React.useState<Record<string, DocPermissionLevel>>({})
  const [savingUserId, setSavingUserId] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [membersRes, permissionsRes] = await Promise.all([
        fetch(`/api/workspaces/${document.workspaceId}/members`),
        fetch(`/api/documents/${document.id}/permissions`),
      ])

      if (!membersRes.ok || !permissionsRes.ok) {
        throw new Error('Failed to load document permissions')
      }

      const [membersData, permissionsData] = await Promise.all([
        membersRes.json() as Promise<WorkspaceMember[]>,
        permissionsRes.json() as Promise<DocPermissionAssignment[]>,
      ])

      setMembers(membersData)
      setPermissionMap(mergePermissionMap(permissionsData))
    } catch (error) {
      toast.error('Failed to load permissions', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
      })
    } finally {
      setLoading(false)
    }
  }, [document.id, document.workspaceId])

  React.useEffect(() => {
    if (!open || !document.canManagePermissions) return
    void fetchData()
  }, [document.canManagePermissions, fetchData, open])

  const filteredMembers = React.useMemo(() => {
    if (!search.trim()) return members

    const query = search.trim().toLowerCase()
    return members.filter((member) =>
      [member.name, member.email].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    )
  }, [members, search])

  const explicitPermissionCount = React.useMemo(
    () => Object.keys(permissionMap).length,
    [permissionMap],
  )

  const handlePermissionChange = React.useCallback(
    async (member: WorkspaceMember, nextValue: string) => {
      const nextLevel =
        nextValue === 'inherit' ? null : (nextValue as DocPermissionLevel)
      const previousLevel = permissionMap[member.userId] ?? null

      setSavingUserId(member.userId)
      setPermissionMap((prev) => {
        if (nextLevel === null) {
          const nextMap = { ...prev }
          delete nextMap[member.userId]
          return nextMap
        }

        return {
          ...prev,
          [member.userId]: nextLevel,
        }
      })

      try {
        const res = await fetch(`/api/documents/${document.id}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: member.userId,
            level: nextLevel,
          }),
        })

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { error?: string }
            | null

          throw new Error(payload?.error ?? 'Failed to update permission')
        }

        await onPermissionsChanged?.()
        toast.success(
          nextLevel
            ? `${member.name ?? member.email ?? 'Member'} can now ${PERMISSION_LABELS[nextLevel].toLowerCase()} this document`
            : `Removed custom access for ${member.name ?? member.email ?? 'member'}`,
        )
      } catch (error) {
        setPermissionMap((prev) => {
          if (previousLevel === null) {
            const nextMap = { ...prev }
            delete nextMap[member.userId]
            return nextMap
          }

          return {
            ...prev,
            [member.userId]: previousLevel,
          }
        })

        toast.error('Failed to update permission', {
          description:
            error instanceof Error
              ? error.message
              : 'Please try again in a moment.',
        })
      } finally {
        setSavingUserId(null)
      }
    },
    [document.id, onPermissionsChanged, permissionMap],
  )

  if (!document.canManagePermissions) {
    if (isControlled) return null
    return document.hasCustomPermissions ? (
      <Badge
        variant="outline"
        className={cn(
          'h-7 gap-1.5 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
          className,
        )}
      >
        <Shield className="size-3" />
        Restricted
      </Badge>
    ) : null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-7 gap-1.5 text-xs', className)}
          >
            <ShieldCheck className="size-3.5" />
            Permissions
            {explicitPermissionCount > 0 ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {explicitPermissionCount}
              </Badge>
            ) : null}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Document permissions</DialogTitle>
          <DialogDescription>
            {document.hasCustomPermissions
              ? 'Custom permissions are active. Private documents are only visible to assigned members, and edit access follows the roles you set here.'
              : 'This document is still using workspace defaults. The first explicit assignment will switch it into document-level access control.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
            <Badge variant="outline" className="h-5 px-2 text-[10px] uppercase tracking-[0.14em]">
              {explicitPermissionCount} explicit
            </Badge>
            <p className="text-xs text-muted-foreground">
              Unassigned members fall back to workspace access for standard documents, but restricted documents only keep explicit assignees, creators, owners, and admins.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workspace members…"
              className="pl-8"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-border/70">
            <div className="grid grid-cols-[1.4fr_0.9fr_0.7fr] gap-3 border-b border-border/70 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <span>Member</span>
              <span>Workspace role</span>
              <span>Document access</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading members…
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No matching members found.
              </div>
            ) : (
              <div className="max-h-[52vh] overflow-y-auto">
                {filteredMembers.map((member) => {
                  const selectedPermission = permissionMap[member.userId] ?? null
                  const lockedReason = isLockedMember(document, member)
                  const isSaving = savingUserId === member.userId

                  return (
                    <div
                      key={member.userId}
                      className="grid grid-cols-[1.4fr_0.9fr_0.7fr] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-8 shrink-0">
                          <AvatarImage src={member.image ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {member.name ?? 'Unnamed'}
                            </p>
                            {document.createdBy === member.userId ? (
                              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                                Creator
                              </Badge>
                            ) : null}
                            {member.status !== 'active' ? (
                              <Badge variant="outline" className="h-5 px-2 text-[10px]">
                                Disabled
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email ?? 'No email'}
                          </p>
                          {lockedReason ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {lockedReason}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="h-5 px-2 text-[10px]">
                          {ROLE_LABELS[member.role]}
                        </Badge>
                        {member.role === 'owner' || member.role === 'admin' ? (
                          <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                            Always manage
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        {isSaving ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : null}
                        <Select
                          value={selectedPermission ?? 'inherit'}
                          onValueChange={(value) => {
                            void handlePermissionChange(member, value)
                          }}
                          disabled={Boolean(lockedReason) || isSaving}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inherit">Inherit</SelectItem>
                            <SelectItem value="view">View</SelectItem>
                            <SelectItem value="edit">Edit</SelectItem>
                            <SelectItem value="manage">Manage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
