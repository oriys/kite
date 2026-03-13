'use client'

import * as React from 'react'
import {
  Plus,
  MoreHorizontal,
  Users,
  Trash2,
  UserPlus,
  UserMinus,
} from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

interface Team {
  id: string
  name: string
  description: string
  parentId: string | null
  createdAt: string
  members?: TeamMember[]
}

interface TeamMember {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  joinedAt: string
}

interface WorkspaceMember {
  userId: string
  name: string | null
  email: string | null
  image: string | null
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

export default function TeamsPage() {
  const workspaceId = useWorkspaceId()
  const [teams, setTeams] = React.useState<Team[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = React.useState<
    (Team & { members: TeamMember[] }) | null
  >(null)
  const [wsMembers, setWsMembers] = React.useState<WorkspaceMember[]>([])

  const fetchTeams = React.useCallback(async () => {
    if (!workspaceId) return
    const res = await fetch(`/api/workspaces/${workspaceId}/teams`)
    if (res.ok) setTeams(await res.json())
  }, [workspaceId])

  const fetchTeamDetail = React.useCallback(
    async (teamId: string) => {
      if (!workspaceId) return
      const res = await fetch(
        `/api/workspaces/${workspaceId}/teams/${teamId}`,
      )
      if (res.ok) {
        const data = await res.json()
        setSelectedTeam(data)
      }
    },
    [workspaceId],
  )

  const fetchWsMembers = React.useCallback(async () => {
    if (!workspaceId) return
    const res = await fetch(`/api/workspaces/${workspaceId}/members`)
    if (res.ok) setWsMembers(await res.json())
  }, [workspaceId])

  React.useEffect(() => {
    if (!workspaceId) return
    Promise.all([fetchTeams(), fetchWsMembers()]).finally(() =>
      setLoading(false),
    )
  }, [workspaceId, fetchTeams, fetchWsMembers])

  React.useEffect(() => {
    if (selectedTeamId) fetchTeamDetail(selectedTeamId)
  }, [selectedTeamId, fetchTeamDetail])

  const handleDeleteTeam = async (teamId: string, name: string) => {
    if (!workspaceId) return
    if (!confirm(`Delete team "${name}"?`)) return
    const res = await fetch(
      `/api/workspaces/${workspaceId}/teams/${teamId}`,
      { method: 'DELETE' },
    )
    if (res.ok) {
      toast.success('Team deleted')
      if (selectedTeamId === teamId) {
        setSelectedTeamId(null)
        setSelectedTeam(null)
      }
      fetchTeams()
    } else {
      toast.error('Failed to delete team')
    }
  }

  const handleAddMember = async (teamId: string, userId: string) => {
    if (!workspaceId) return
    const res = await fetch(
      `/api/workspaces/${workspaceId}/teams/${teamId}/members`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      },
    )
    if (res.ok) {
      toast.success('Member added')
      fetchTeamDetail(teamId)
    } else {
      toast.error('Failed to add member')
    }
  }

  const handleRemoveMember = async (teamId: string, userId: string) => {
    if (!workspaceId) return
    const res = await fetch(
      `/api/workspaces/${workspaceId}/teams/${teamId}/members/${userId}`,
      { method: 'DELETE' },
    )
    if (res.ok) {
      toast.success('Member removed')
      fetchTeamDetail(teamId)
    } else {
      toast.error('Failed to remove member')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  // Build hierarchy
  const rootTeams = teams.filter((t) => !t.parentId)
  const childrenOf = (id: string) => teams.filter((t) => t.parentId === id)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize members into teams for easier permission management.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Team list */}
        <div className="w-64 shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Teams
            </span>
            {workspaceId && (
              <CreateTeamDialog
                workspaceId={workspaceId}
                teams={teams}
                onSuccess={() => fetchTeams()}
              />
            )}
          </div>

          {teams.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No teams yet.
            </p>
          ) : (
            <div className="space-y-0.5">
              {rootTeams.map((team) => (
                <TeamTreeNode
                  key={team.id}
                  team={team}
                  getChildren={childrenOf}
                  selectedId={selectedTeamId}
                  onSelect={setSelectedTeamId}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Team detail */}
        <div className="min-w-0 flex-1">
          {selectedTeam ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedTeam.name}</h2>
                  {selectedTeam.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {selectedTeam.description}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() =>
                        handleDeleteTeam(selectedTeam.id, selectedTeam.name)
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">
                  Members
                  <Badge variant="secondary" className="ml-2">
                    {selectedTeam.members?.length ?? 0}
                  </Badge>
                </span>
                <AddMemberSelect
                  wsMembers={wsMembers}
                  teamMembers={selectedTeam.members ?? []}
                  onAdd={(userId) =>
                    handleAddMember(selectedTeam.id, userId)
                  }
                />
              </div>

              <div className="rounded-lg border border-border bg-card">
                {(selectedTeam.members?.length ?? 0) === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No members in this team yet.
                  </p>
                ) : (
                  selectedTeam.members?.map((m) => {
                    const initials = (m.name ?? m.email ?? '?')
                      .split(/[\s@]/)
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between border-b border-border/50 px-4 py-2.5 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={m.image ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {m.name ?? 'Unnamed'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.email}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            handleRemoveMember(selectedTeam.id, m.userId)
                          }
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              Select a team to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamTreeNode({
  team,
  getChildren,
  selectedId,
  onSelect,
  depth,
}: {
  team: Team
  getChildren: (id: string) => Team[]
  selectedId: string | null
  onSelect: (id: string) => void
  depth: number
}) {
  const kids = getChildren(team.id)
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(team.id)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          selectedId === team.id
            ? 'bg-accent/50 font-medium text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <Users className="h-4 w-4 shrink-0" />
        <span className="truncate">{team.name}</span>
      </button>
      {kids.map((child) => (
        <TeamTreeNode
          key={child.id}
          team={child}
          getChildren={getChildren}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

function AddMemberSelect({
  wsMembers,
  teamMembers,
  onAdd,
}: {
  wsMembers: WorkspaceMember[]
  teamMembers: TeamMember[]
  onAdd: (userId: string) => void
}) {
  const teamMemberIds = new Set(teamMembers.map((m) => m.userId))
  const available = wsMembers.filter((m) => !teamMemberIds.has(m.userId))

  if (available.length === 0) return null

  return (
    <Select onValueChange={onAdd}>
      <SelectTrigger className="h-7 w-auto gap-1.5 text-xs">
        <UserPlus className="h-3.5 w-3.5" />
        <span>Add member</span>
      </SelectTrigger>
      <SelectContent>
        {available.map((m) => (
          <SelectItem key={m.userId} value={m.userId}>
            {m.name ?? m.email ?? m.userId}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CreateTeamDialog({
  workspaceId,
  teams,
  onSuccess,
}: {
  workspaceId: string
  teams: Team[]
  onSuccess: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [parentId, setParentId] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const body: Record<string, string | null> = {
        name,
        description,
        parentId: parentId || null,
      }
      const res = await fetch(`/api/workspaces/${workspaceId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Team created')
        setName('')
        setDescription('')
        setParentId('')
        setOpen(false)
        onSuccess()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to create team')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            Organize members into groups for streamlined access control.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="e.g. Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="What does this team do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {teams.length > 0 && (
            <div className="space-y-2">
              <Label>Parent team (optional)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? 'Creating…' : 'Create team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
