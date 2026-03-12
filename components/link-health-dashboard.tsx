'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { Link, ShieldCheck, ShieldAlert, RefreshCw, ExternalLink } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface LinkCheck {
  id: string
  url: string
  statusCode: number | null
  isAlive: boolean
  errorMessage: string | null
  lastCheckedAt: string
  documentId: string
  documentTitle: string | null
}

interface Summary {
  totalLinks: number
  aliveLinks: number
  deadLinks: number
  lastCheckedAt: string | null
}

const tooltipStyle = {
  borderRadius: '0.375rem',
  border: '1px solid var(--border)',
  background: 'var(--card)',
  fontSize: '0.75rem',
}

export function LinkHealthDashboard() {
  const [checks, setChecks] = useState<LinkCheck[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/link-checks')
      if (!res.ok) return
      const data = await res.json()
      setChecks(data.checks)
      setSummary(data.summary)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleScan() {
    setScanning(true)
    try {
      const res = await fetch('/api/link-checks', { method: 'POST' })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setScanning(false)
    }
  }

  const brokenLinks = checks.filter((c) => !c.isAlive)

  const chartData = summary
    ? [
        { name: 'Healthy', value: summary.aliveLinks },
        { name: 'Broken', value: summary.deadLinks },
      ]
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Link Health</h2>
          <p className="text-sm text-muted-foreground">
            Monitor the status of external links across your documentation.
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning} size="sm" variant="outline">
          <RefreshCw className={cn('mr-2 h-4 w-4', scanning && 'animate-spin')} />
          {scanning ? 'Scanning…' : 'Scan Now'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Links</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-semibold tabular-nums">{summary?.totalLinks ?? 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Healthy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-tone-success-text" />
              <span className="text-2xl font-semibold tabular-nums text-tone-success-text">
                {summary?.aliveLinks ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Broken</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-tone-error-text" />
              <span className="text-2xl font-semibold tabular-nums text-tone-error-text">
                {summary?.deadLinks ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Checked</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-muted-foreground">
              {summary?.lastCheckedAt
                ? new Date(summary.lastCheckedAt).toLocaleString()
                : 'Never'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Broken Links */}
      <div className="grid gap-6 lg:grid-cols-3">
        {summary && summary.totalLinks > 0 && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Health Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill="var(--chart-1)" />
                    <Cell fill="var(--chart-5)" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-chart-1" />
                  Healthy
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-chart-5" />
                  Broken
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={cn(summary && summary.totalLinks > 0 ? 'lg:col-span-2' : 'lg:col-span-3')}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Broken Links</CardTitle>
            <CardDescription>
              {brokenLinks.length === 0
                ? 'No broken links found.'
                : `${brokenLinks.length} broken link${brokenLinks.length === 1 ? '' : 's'} detected.`}
            </CardDescription>
          </CardHeader>
          {brokenLinks.length > 0 ? (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Last Checked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brokenLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium text-foreground">
                        {link.documentTitle ?? 'Untitled'}
                      </TableCell>
                      <TableCell>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <span className="max-w-[200px] truncate">{link.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="tabular-nums border-tone-error-border bg-tone-error-bg text-tone-error-text"
                        >
                          {link.statusCode ?? '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {link.errorMessage ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(link.lastCheckedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          ) : (
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShieldCheck className="mb-2 size-6 text-tone-success-text" />
                <p className="text-sm text-muted-foreground">All links are healthy</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
