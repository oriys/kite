'use client'

import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { Eye, Users, FileText, CalendarDays, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ViewsByDay {
  date: string
  views: number
  uniqueVisitors: number
}

interface TopDocument {
  documentId: string | null
  title: string
  views: number
  uniqueVisitors: number
  lastViewed: string
}

interface PageAnalyticsData {
  totalViews: number
  uniqueVisitors: number
  viewsTrend: number
  avgViewsPerDoc: number
  mostActiveDay: string
  viewsByDay: ViewsByDay[]
  topDocuments: TopDocument[]
}

const tooltipStyle = {
  borderRadius: '0.75rem',
  border: '1px solid var(--analytics-grid)',
  background: 'var(--analytics-surface)',
  color: 'var(--foreground)',
  fontSize: '0.75rem',
  boxShadow:
    '0 18px 40px -28px color-mix(in oklab, var(--foreground) 20%, transparent)',
} satisfies CSSProperties

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTrend(trend: number) {
  const sign = trend >= 0 ? '+' : ''
  return `${sign}${trend.toFixed(1)}%`
}

export function PageAnalyticsDashboard() {
  const [data, setData] = useState<PageAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/overview?days=30')
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
          <Eye className="size-8 text-muted-foreground" />
        </div>
        <p className="mb-1 text-sm font-medium text-foreground">
          No page view data
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Page view analytics will appear here once readers start visiting your
          documentation.
        </p>
      </div>
    )
  }

  const chartData = data.viewsByDay.map((d) => ({
    date: formatDate(d.date),
    views: d.views,
    visitors: d.uniqueVisitors,
  }))

  const TrendIcon = data.viewsTrend >= 0 ? ArrowUpRight : ArrowDownRight
  const trendColor =
    data.viewsTrend >= 0
      ? 'var(--tone-success-text, var(--analytics-ink-medium))'
      : 'var(--tone-error-text, var(--analytics-ink-soft))'

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Total Page Views</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-[var(--analytics-ink-soft)]" />
              <span className="text-2xl font-semibold tabular-nums">
                {data.totalViews.toLocaleString()}
              </span>
            </div>
            {data.viewsTrend !== 0 && (
              <div className="mt-1 flex items-center gap-1">
                <TrendIcon className="size-3" style={{ color: trendColor }} />
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{ color: trendColor }}
                >
                  {formatTrend(data.viewsTrend)} vs prev period
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Unique Visitors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[var(--analytics-ink-soft)]" />
              <span className="text-2xl font-semibold tabular-nums">
                {data.uniqueVisitors.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Avg Views / Document</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-[var(--analytics-ink-soft)]" />
              <span className="text-2xl font-semibold tabular-nums">
                {data.avgViewsPerDoc.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Most Active Day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-[var(--analytics-ink-soft)]" />
              <span className="text-2xl font-semibold tabular-nums">
                {data.mostActiveDay !== '—'
                  ? formatDate(data.mostActiveDay)
                  : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {chartData.length > 0 && (
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Views Over Time
            </CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--analytics-ink-medium)"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--analytics-ink-medium)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="visitorsFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--analytics-ink-faint)"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--analytics-ink-faint)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--analytics-grid)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  className="fill-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="fill-muted-foreground"
                  width={40}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="var(--analytics-ink-medium)"
                  fill="url(#viewsFill)"
                  strokeWidth={1.5}
                  name="Views"
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  stroke="var(--analytics-ink-faint)"
                  fill="url(#visitorsFill)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  name="Unique Visitors"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: 'var(--analytics-ink-medium)' }}
                />
                Views
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: 'var(--analytics-ink-faint)' }}
                />
                Unique Visitors
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Documents Table */}
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Documents</CardTitle>
          <CardDescription>Most viewed pages in the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No document views recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Last Viewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topDocuments.map((doc) => (
                  <TableRow key={doc.documentId}>
                    <TableCell className="font-medium text-foreground">
                      {doc.title}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {doc.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {doc.uniqueVisitors.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {doc.lastViewed ? formatDate(doc.lastViewed) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
