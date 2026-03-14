'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Search, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'

interface WorkspaceMember {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: string
}

interface SubmitForReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  documentTitle: string
  workspaceId: string
  onConfirm: () => void
}

export function SubmitForReviewDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  workspaceId,
  onConfirm,
}: SubmitForReviewDialogProps) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  const [members, setMembers] = React.useState<WorkspaceMember[]>([])
  const [loadingMembers, setLoadingMembers] = React.useState(false)
  const [selectedReviewerIds, setSelectedReviewerIds] = React.useState<Set<string>>(new Set())
  const [description, setDescription] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  // Fetch members when dialog opens
  React.useEffect(() => {
    if (!open || !workspaceId) return
    let active = true

    async function loadMembers() {
      setLoadingMembers(true)
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/members`)
        if (res.ok && active) {
          const data = (await res.json()) as WorkspaceMember[]
          setMembers(data)
        }
      } catch {
        // Silently fail — empty member list
      } finally {
        if (active) setLoadingMembers(false)
      }
    }

    void loadMembers()
    return () => { active = false }
  }, [open, workspaceId])

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedReviewerIds(new Set())
      setDescription('')
      setSearch('')
    }
  }, [open])

  const eligibleMembers = members.filter(
    (m) => m.userId !== currentUserId && m.role !== 'guest',
  )

  const filteredMembers = search.trim()
    ? eligibleMembers.filter(
        (m) =>
          m.name?.toLowerCase().includes(search.toLowerCase()) ||
          m.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : eligibleMembers

  function toggleReviewer(userId: string) {
    setSelectedReviewerIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  async function handleSubmit() {
    if (selectedReviewerIds.size === 0) {
      toast.error('Select at least one reviewer')
      return
    }

    setSubmitting(true)
    try {
      // Create approval request
      const approvalRes = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          title: `Review: ${documentTitle}`,
          reviewerIds: Array.from(selectedReviewerIds),
          description: description.trim() || undefined,
          requiredApprovals: selectedReviewerIds.size,
        }),
      })

      if (!approvalRes.ok) {
        const body = await approvalRes.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to create approval request')
      }

      // Transition document to review
      onConfirm()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit for review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit for Review</DialogTitle>
          <DialogDescription>
            Select reviewers who will approve &ldquo;{documentTitle}&rdquo; before
            it can be published.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Reviewer selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Reviewers
            </label>

            {eligibleMembers.length > 4 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            )}

            <div className="max-h-52 overflow-y-auto rounded-md border">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading members…
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-6 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  {search ? 'No matching members' : 'No eligible reviewers'}
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const checked = selectedReviewerIds.has(member.userId)
                  return (
                    <label
                      key={member.userId}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2 last:border-0',
                        'transition-colors hover:bg-muted/40',
                        checked && 'bg-accent/30',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleReviewer(member.userId)}
                      />
                      <Avatar className="size-6">
                        <AvatarImage src={member.image ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {(member.name ?? '?')[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {member.name ?? member.email ?? 'Unknown'}
                        </p>
                        {member.name && member.email && (
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {member.role}
                      </Badge>
                    </label>
                  )
                })
              )}
            </div>

            {selectedReviewerIds.size > 0 && (
              <p className="text-xs text-muted-foreground">
                <CheckCircle2 className="mr-1 inline size-3 text-success" />
                {selectedReviewerIds.size} reviewer{selectedReviewerIds.size > 1 ? 's' : ''} selected
                — all must approve
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context for reviewers…"
              className="min-h-[60px] resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedReviewerIds.size === 0}
          >
            {submitting ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : null}
            Submit for Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
