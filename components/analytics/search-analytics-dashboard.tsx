'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { Search, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
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

const PIE_COLORS = [
  'oklch(0.65 0.15 244)',
  'oklch(0.65 0.2 15)',
]

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
      <p className="py-10 text-center text-sm text-muted-foreground">
        Failed to load search analytics.
      </p>
    )
  }

  const zeroResultPct = (data.zeroResultRate * 100).toFixed(1)
  const successPct = ((1 - data.zeroResultRate) * 100).toFixed(1)

  const pieData = [
    { name: 'With results', value: data.totalSearches - Math.round(data.totalSearches * data.zeroResultRate) },
    { name: 'Zero results', value: Math.round(data.totalSearches * data.zeroResultRate) },
  ]

  // Build a simple trend from top queries as a stand-in for time series
  const trendData = data.topQueries.slice(0, 10).map((q, i) => ({
    name: q.query.length > 15 ? q.query.slice(0, 15) + '…' : q.query,
    searches: q.count,
    index: i,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Search Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Understand how users search your documentation.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Searches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold tabular-nums">{data.totalSearches}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Zero-Result Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn(
                  'h-4 w-4',
                  data.zeroResultRate > 0.2 ? 'text-rose-600' : 'text-amber-500',
                )}
              />
              <span
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  data.zeroResultRate > 0.2 ? 'text-rose-600' : 'text-amber-500',
                )}
              >
                {zeroResultPct}%
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-2xl font-bold tabular-nums text-emerald-600">
                {successPct}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {data.totalSearches > 0 && (
          <Card>
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
                  >
                    {pieData.map((_entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[0] }} />
                  With results
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[1] }} />
                  Zero results
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {trendData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top Queries by Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="searches"
                    stroke="oklch(0.65 0.15 244)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
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
                      <TableCell className="font-mono text-sm">{q.query}</TableCell>
                      <TableCell className="text-right tabular-nums">{q.count}</TableCell>
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
                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                          {q.query}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{q.count}</TableCell>
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
