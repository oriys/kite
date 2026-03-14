'use client'

import * as React from 'react'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string'
    ? body.error
    : 'Unable to load approval request'
}

interface Reviewer {
  id: string
  reviewerId: string
  decision: 'approved' | 'rejected' | 'changes_requested' | null
  comment: string | null
  decidedAt: string | null
  reviewer: {
    id: string
    name: string | null
    image: string | null
  }
}

interface ApprovalRequest {
  id: string
  documentId: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  title: string
  description: string
  requiredApprovals: number
  deadline: string | null
  createdAt: string
  requester: {
    id: string
    name: string | null
    image: string | null
  }
  reviewers: Reviewer[]
}

interface ApprovalBannerProps {
  documentId: string
  currentUserId: string
  onStatusChange?: (status: ApprovalRequest['status']) => void
  className?: string
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pending Review',
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
  },
  approved: {
    icon: CheckCircle2,
    label: 'Approved',
    color: 'text-success',
    bg: 'bg-success/10 border-success/20',
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/20',
  },
  cancelled: {
    icon: AlertCircle,
    label: 'Cancelled',
    color: 'text-muted-foreground',
    bg: 'bg-muted border-muted',
  },
} as const

function getDismissedApprovalKey(approvalId: string, status: string) {
  return `approval-banner-dismissed:${approvalId}:${status}`
}

export function ApprovalBanner({
  documentId,
  currentUserId,
  onStatusChange,
  className,
}: ApprovalBannerProps) {
  const [approval, setApproval] = React.useState<ApprovalRequest | null>(null)
  const [comment, setComment] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    let active = true

    async function loadApproval() {
      try {
        const params = new URLSearchParams({
          documentId,
          limit: '1',
        })
        const response = await fetch(`/api/approvals?${params.toString()}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const data = (await response.json().catch(() => [])) as ApprovalRequest[]
        if (!active) return

        const nextApproval = data[0] ?? null
        setApproval(nextApproval)
        if (nextApproval && typeof window !== 'undefined') {
          setDismissed(
            window.localStorage.getItem(
              getDismissedApprovalKey(nextApproval.id, nextApproval.status),
            ) === '1',
          )
        } else {
          setDismissed(false)
        }
      } catch {
        if (!active) return
        setApproval(null)
        setDismissed(false)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadApproval()

    return () => {
      active = false
    }
  }, [documentId])

  if (loading || !approval || dismissed) return null

  const isReviewer = approval.reviewers.some(
    (r) => r.reviewerId === currentUserId && !r.decision,
  )
  const config = statusConfig[approval.status]
  const StatusIcon = config.icon
  const approvedCount = approval.reviewers.filter(
    (r) => r.decision === 'approved',
  ).length
  const pendingReviewers = approval.reviewers.filter((r) => !r.decision).length

  const handleDecision = async (
    decision: 'approved' | 'rejected' | 'changes_requested',
  ) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/approvals/${approval.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comment }),
      })
      if (res.ok) {
        const data = await res.json()
        const newStatus = data.requestStatus ?? approval.status
        setApproval((prev) =>
          prev
            ? { ...prev, status: newStatus }
            : null,
        )
        setDismissed(false)
        onStatusChange?.(newStatus)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        getDismissedApprovalKey(approval.id, approval.status),
        '1',
      )
    }
    setDismissed(true)
  }

  return (
    <Card className={cn('border', config.bg, className)}>
      <CardHeader className="py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 overflow-hidden">
              <StatusIcon className={cn('size-4 shrink-0', config.color)} />
              <CardTitle className="shrink-0 text-sm">{config.label}</CardTitle>
              <Badge variant="outline" className="shrink-0 text-xs">
                {approvedCount}/{approval.requiredApprovals} approvals
              </Badge>
              <Badge variant="outline" className="shrink-0 text-xs">
                {pendingReviewers} pending
              </Badge>
              {approval.deadline ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  Due {new Date(approval.deadline).toLocaleDateString()}
                </span>
              ) : null}
              <span className="truncate text-xs text-muted-foreground">
                {approval.title}
                {approval.description ? ` — ${approval.description}` : ''}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => setDetailsOpen((current) => !current)}
            >
              {detailsOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              {detailsOpen ? 'Hide' : 'Details'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="Dismiss approval banner"
              onClick={handleDismiss}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {detailsOpen ? (
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            {approval.reviewers.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-1.5 rounded-md border border-border/70 bg-background/60 px-2 py-1"
              >
                <Avatar className="size-5">
                  <AvatarImage src={r.reviewer.image ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(r.reviewer.name ?? '?')[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[8rem] truncate text-xs">
                  {r.reviewer.name ?? 'Unknown'}
                </span>
                {r.decision === 'approved' ? (
                  <CheckCircle2 className="size-3 text-success" />
                ) : r.decision === 'rejected' ? (
                  <XCircle className="size-3 text-destructive" />
                ) : r.decision === 'changes_requested' ? (
                  <AlertCircle className="size-3 text-warning" />
                ) : (
                  <Clock className="size-3 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-border/70 pt-3">
            <div className="grid gap-1 text-xs text-muted-foreground">
              <p>
                Requested by {approval.requester.name ?? 'Unknown'} ·{' '}
                {new Date(approval.createdAt).toLocaleDateString()}
              </p>
              {approval.description ? <p>{approval.description}</p> : null}
            </div>
          </div>

          {isReviewer && approval.status === 'pending' ? (
            <div className="space-y-2 border-t border-border/70 pt-3">
              <Textarea
                placeholder="Add a comment (optional)…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[56px] text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="xs"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  disabled={submitting}
                  onClick={() => handleDecision('approved')}
                >
                  <CheckCircle2 className="size-3" />
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleDecision('changes_requested')}
                >
                  Request Changes
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  disabled={submitting}
                  onClick={() => handleDecision('rejected')}
                >
                  <XCircle className="size-3" />
                  Reject
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  )
}
