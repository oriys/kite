'use client'

import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { Search, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface QueryCount {
  query: string
  count: number
}

interface SearchAnalyticsData {
  totalSearches: number
  zeroResultRate: number
  topQueries: QueryCount[]
  zeroResultQueries: QueryCount[]
}

const tooltipStyle = {
  borderRadius: '0.75rem',
  border: '1px solid var(--analytics-grid)',
  background: 'var(--analytics-surface)',
  color: 'var(--foreground)',
  fontSize: '0.75rem',
  boxShadow: '0 18px 40px -28px color-mix(in oklab, var(--foreground) 20%, transparent)',
} satisfies CSSProperties

export function SearchAnalyticsDashboard() {
  const [data, setData] = useState<SearchAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/search')
      if (!res.ok) return
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-muted/60 p-4">
          <Search className="size-8 text-muted-foreground" />
        </div>
        <p className="mb-1 text-sm font-medium text-foreground">No analytics data</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Search analytics will appear here once users start searching your documentation.
        </p>
      </div>
    )
  }

  const zeroResultPct = (data.zeroResultRate * 100).toFixed(1)
  const successPct = ((1 - data.zeroResultRate) * 100).toFixed(1)

  const pieData = [
    { name: 'With results', value: data.totalSearches - Math.round(data.totalSearches * data.zeroResultRate) },
    { name: 'Zero results', value: Math.round(data.totalSearches * data.zeroResultRate) },
  ]

  const barData = data.topQueries.slice(0, 10).map((q) => ({
    name: q.query.length > 15 ? q.query.slice(0, 15) + '…' : q.query,
    searches: q.count,
  }))

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Total Searches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--analytics-ink-soft)]" />
              <span className="text-2xl font-semibold tabular-nums">{data.totalSearches}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Zero-Result Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn('h-4 w-4')}
                style={{
                  color:
                    data.zeroResultRate > 0.2
                      ? 'var(--analytics-ink-strong)'
                      : 'var(--analytics-ink-medium)',
                }}
              />
              <span
                className="text-2xl font-semibold tabular-nums"
                style={{
                  color:
                    data.zeroResultRate > 0.2
                      ? 'var(--analytics-ink-strong)'
                      : 'var(--analytics-ink-medium)',
                }}
              >
                {zeroResultPct}%
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--analytics-ink-medium)]" />
              <span className="text-2xl font-semibold tabular-nums text-[var(--analytics-ink-medium)]">
                {successPct}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {data.totalSearches > 0 && (
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Result Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="var(--card)"
                    strokeWidth={3}
                  >
                    <Cell fill="var(--analytics-ink-medium)" />
                    <Cell fill="var(--analytics-ink-faint)" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'var(--analytics-ink-medium)' }}
                  />
                  With results
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'var(--analytics-ink-faint)' }}
                  />
                  Zero results
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {barData.length > 0 && (
          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top Queries by Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--analytics-grid)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} className="fill-muted-foreground" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="searches"
                    fill="var(--analytics-ink-medium)"
                    radius={[0, 3, 3, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Search Queries</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topQueries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No search data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topQueries.map((q) => (
                    <TableRow key={q.query}>
                      <TableCell className="font-mono text-sm text-foreground">{q.query}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{q.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Zero-Result Searches</CardTitle>
            <CardDescription>Queries where users found nothing — content gaps.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.zeroResultQueries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No zero-result searches.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.zeroResultQueries.map((q) => (
                    <TableRow key={q.query}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-border/70 bg-[var(--analytics-surface)] text-foreground"
                        >
                          {q.query}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{q.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
