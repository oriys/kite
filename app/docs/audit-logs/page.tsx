'use client'

import * as React from 'react'
import {
  Clock,
  FileText,
  Pencil,
  Trash2,
  Eye,
  ShieldCheck,
  Archive,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'

interface AuditLog {
  id: string
  actorName: string | null
  actorImage: string | null
  action: string
  resourceType: string
  resourceTitle: string | null
  ipAddress: string | null
  createdAt: string
}

const actionIcons: Record<string, typeof FileText> = {
  create: FileText,
  update: Pencil,
  delete: Trash2,
  publish: Eye,
  archive: Archive,
  approve: ShieldCheck,
  reject: ShieldCheck,
  status_change: Clock,
  visibility_change: Eye,
  export: Download,
}

const actionLabels: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  publish: 'Published',
  archive: 'Archived',
  approve: 'Approved',
  reject: 'Rejected',
  status_change: 'Status Changed',
  visibility_change: 'Visibility Changed',
  login: 'Logged In',
  export: 'Exported',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditLog[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [actionFilter, setActionFilter] = React.useState<string>('all')
  const [page, setPage] = React.useState(0)
  const pageSize = 30

  React.useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(page * pageSize),
    })
    if (actionFilter !== 'all') params.set('action', actionFilter)

    fetch(`/api/audit-logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs)
        setTotal(data.total)
      })
      .finally(() => setLoading(false))
  }, [actionFilter, page])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track all workspace activity and changes
          </p>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.entries(actionLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Spinner className="mx-auto size-5 text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No audit logs found
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => {
            const Icon = actionIcons[log.action] ?? Clock
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-md border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {log.actorName ?? 'System'}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {actionLabels[log.action] ?? log.action}
                    </span>{' '}
                    <Badge variant="outline" className="text-[10px]">
                      {log.resourceType}
                    </Badge>{' '}
                    {log.resourceTitle && (
                      <span className="font-medium">{log.resourceTitle}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                    {log.ipAddress && ` · ${log.ipAddress}`}
                  </p>
                </div>
                {log.actorImage && (
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={log.actorImage} />
                    <AvatarFallback className="text-[10px]">
                      {(log.actorName ?? '?')[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {total} total entries
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex h-7 items-center px-2 text-xs">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
