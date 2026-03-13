'use client'

import * as React from 'react'
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
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

export function ApprovalBanner({
  documentId,
  currentUserId,
  className,
}: ApprovalBannerProps) {
  const [approval, setApproval] = React.useState<ApprovalRequest | null>(null)
  const [comment, setComment] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    let active = true

    async function loadApproval() {
      try {
        const params = new URLSearchParams({
          status: 'pending',
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

        setApproval(data[0] ?? null)
      } catch {
        if (!active) return
        setApproval(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadApproval()

    return () => {
      active = false
    }
  }, [documentId])

  if (loading || !approval) return null

  const isReviewer = approval.reviewers.some(
    (r) => r.reviewerId === currentUserId && !r.decision,
  )
  const config = statusConfig[approval.status]
  const StatusIcon = config.icon
  const approvedCount = approval.reviewers.filter(
    (r) => r.decision === 'approved',
  ).length

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
        setApproval((prev) =>
          prev
            ? { ...prev, status: data.requestStatus ?? prev.status }
            : null,
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className={cn('border', config.bg, className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('h-4 w-4', config.color)} />
            <CardTitle className="text-sm">{config.label}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {approvedCount}/{approval.requiredApprovals} approvals
            </Badge>
          </div>
          {approval.deadline && (
            <span className="text-xs text-muted-foreground">
              Due {new Date(approval.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
        <CardDescription className="text-xs">
          {approval.title}
          {approval.description && ` — ${approval.description}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {approval.reviewers.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-1.5 rounded-md border px-2 py-1"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={r.reviewer.image ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {(r.reviewer.name ?? '?')[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{r.reviewer.name ?? 'Unknown'}</span>
              {r.decision === 'approved' && (
                <CheckCircle2 className="h-3 w-3 text-success" />
              )}
              {r.decision === 'rejected' && (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
              {r.decision === 'changes_requested' && (
                <AlertCircle className="h-3 w-3 text-warning" />
              )}
            </div>
          ))}
        </div>

        {isReviewer && approval.status === 'pending' && (
          <div className="space-y-2 border-t pt-3">
            <Textarea
              placeholder="Add a comment (optional)…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 bg-success text-success-foreground hover:bg-success/90"
                disabled={submitting}
                onClick={() => handleDecision('approved')}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={submitting}
                onClick={() => handleDecision('changes_requested')}
              >
                Request Changes
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7"
                disabled={submitting}
                onClick={() => handleDecision('rejected')}
              >
                <XCircle className="mr-1 h-3 w-3" />
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
