'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FeatureGuard } from '@/components/docs/feature-guard'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'

async function parseResponseError(response: Response) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === 'string'
    ? body.error
    : 'Unable to load approval requests'
}

interface ApprovalItem {
  id: string
  status: string
  title: string
  description: string
  requiredApprovals: number
  deadline: string | null
  createdAt: string
  document: { id: string; title: string }
  requester: { id: string; name: string | null; image: string | null }
  reviewers: Array<{
    id: string
    decision: string | null
    reviewer: { id: string; name: string | null; image: string | null }
  }>
}

const statusConfig: Record<
  string,
  { icon: typeof Clock; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { icon: Clock, label: 'Pending', variant: 'secondary' },
  approved: { icon: CheckCircle2, label: 'Approved', variant: 'default' },
  rejected: { icon: XCircle, label: 'Rejected', variant: 'destructive' },
  cancelled: { icon: AlertCircle, label: 'Cancelled', variant: 'outline' },
}

export default function ApprovalsPage() {
  const [items, setItems] = React.useState<ApprovalItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<string>('all')
  const [reloadNonce, setReloadNonce] = React.useState(0)

  React.useEffect(() => {
    let active = true

    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)

    async function loadApprovals() {
      setLoading(true)

      try {
        const response = await fetch(`/api/approvals?${params}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(await parseResponseError(response))
        }

        const data = (await response.json().catch(() => [])) as ApprovalItem[]
        if (!active) return

        setItems(Array.isArray(data) ? data : [])
        setError(null)
      } catch (nextError) {
        if (!active) return

        setItems([])
        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load approval requests',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadApprovals()

    return () => {
      active = false
    }
  }, [filter, reloadNonce])

  return (
    <FeatureGuard featureId="approvals">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Approval Queue
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review and manage document approval requests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadNonce((current) => current + 1)}
              disabled={loading}
            >
              <RefreshCw data-icon="inline-start" className={loading ? 'animate-spin' : undefined} />
              Refresh
            </Button>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Spinner className="mx-auto size-5 text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Unable to load approvals
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                No approval requests yet
              </p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                This workspace does not have any approval requests in the current queue.
                Once a document enters the approval workflow, reviewers and decisions will
                appear here.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/docs">
                    Open documents
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const cfg = statusConfig[item.status] ?? statusConfig.pending
              const Icon = cfg.icon
              const approvedCount = item.reviewers.filter(
                (r) => r.decision === 'approved',
              ).length
              return (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm">{item.title}</CardTitle>
                        <Badge variant={cfg.variant} className="text-[10px]">
                          <Icon className="mr-1 h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {approvedCount}/{item.requiredApprovals}
                        </Badge>
                      </div>
                      {item.deadline && (
                        <span className="text-xs text-muted-foreground">
                          Due {new Date(item.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      <span className="font-medium">
                        {item.document?.title ?? 'Untitled'}
                      </span>
                      {' · Requested by '}
                      {item.requester?.name ?? 'Unknown'}
                      {' · '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      {item.reviewers.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-1.5 rounded-md border px-2 py-1"
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={r.reviewer.image ?? undefined} />
                            <AvatarFallback className="text-[8px]">
                              {(r.reviewer.name ?? '?')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">
                            {r.reviewer.name ?? 'Unknown'}
                          </span>
                          {r.decision === 'approved' && (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          )}
                          {r.decision === 'rejected' && (
                            <XCircle className="h-3 w-3 text-destructive" />
                          )}
                          {r.decision === 'changes_requested' && (
                            <AlertCircle className="h-3 w-3 text-warning" />
                          )}
                          {!r.decision && (
                            <Clock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </FeatureGuard>
  )
}
