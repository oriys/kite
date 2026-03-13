'use client'

import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface RankingEntry {
  documentId: string
  title: string
  helpful: number
  notHelpful: number
  ratio: number
}

interface FeedbackComment {
  id: string
  documentId: string
  documentTitle: string
  isHelpful: boolean
  comment: string | null
  createdAt: string
}

interface FeedbackData {
  ranking: RankingEntry[]
  recentComments: FeedbackComment[]
}

const tooltipStyle = {
  borderRadius: '0.75rem',
  border: '1px solid var(--analytics-grid)',
  background: 'var(--analytics-surface)',
  color: 'var(--foreground)',
  fontSize: '0.75rem',
  boxShadow: '0 18px 40px -28px color-mix(in oklab, var(--foreground) 20%, transparent)',
} satisfies CSSProperties

export function FeedbackDashboard() {
  const [data, setData] = useState<FeedbackData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/feedback')
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
          <MessageSquare className="size-8 text-muted-foreground" />
        </div>
        <p className="mb-1 text-sm font-medium text-foreground">No feedback data</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Feedback analytics will appear here once readers start rating your documentation.
        </p>
      </div>
    )
  }

  const totalFeedback = data.ranking.reduce(
    (acc, r) => acc + r.helpful + r.notHelpful,
    0,
  )
  const totalHelpful = data.ranking.reduce((acc, r) => acc + r.helpful, 0)
  const overallRatio = totalFeedback > 0 ? totalHelpful / totalFeedback : 0

  const chartData = data.ranking.slice(0, 10).map((r) => ({
    name: r.title.length > 20 ? r.title.slice(0, 20) + '…' : r.title,
    helpful: r.helpful,
    notHelpful: r.notHelpful,
  }))

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Total Feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--analytics-ink-soft)]" />
              <span className="text-2xl font-semibold tabular-nums">{totalFeedback}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Helpfulness Ratio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-[var(--analytics-ink-medium)]" />
              <span className="text-2xl font-semibold tabular-nums text-[var(--analytics-ink-medium)]">
                {(overallRatio * 100).toFixed(1)}%
              </span>
            </div>
            <Progress
              value={overallRatio * 100}
              className="h-1.5 bg-[var(--analytics-surface-strong)] [&_[data-slot=progress-indicator]]:bg-[var(--analytics-ink-strong)]"
            />
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="pb-2">
            <CardDescription>Documents Rated</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold tabular-nums">{data.ranking.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Feedback by Document (Worst First)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--analytics-grid)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="helpful" stackId="a" fill="var(--analytics-ink-medium)" name="Helpful" radius={[0, 0, 0, 0]} />
                <Bar dataKey="notHelpful" stackId="a" fill="var(--analytics-ink-faint)" name="Not Helpful" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: 'var(--analytics-ink-medium)' }}
                />
                Helpful
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: 'var(--analytics-ink-faint)' }}
                />
                Not Helpful
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Document Ranking</CardTitle>
            <CardDescription>Sorted by helpfulness (worst first)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feedback yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Helpful</TableHead>
                    <TableHead className="text-right">Unhelpful</TableHead>
                    <TableHead className="text-right">Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ranking.map((r) => (
                    <TableRow key={r.documentId}>
                      <TableCell className="max-w-[200px] truncate font-medium text-foreground">
                        {r.title}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">
                        {r.helpful}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-[var(--analytics-ink-soft)]">
                        {r.notHelpful}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            'tabular-nums',
                            r.ratio >= 0.7
                              ? 'border-border/70 bg-[var(--analytics-surface)] text-foreground'
                              : r.ratio >= 0.4
                                ? 'border-border/70 bg-muted/70 text-foreground'
                                : 'border-border/70 bg-transparent text-muted-foreground',
                          )}
                        >
                          {(r.ratio * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Comments</CardTitle>
            <CardDescription>Latest feedback with written comments</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentComments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {data.recentComments.map((fb) => (
                  <div
                    key={fb.id}
                    className="rounded-lg border border-border/70 bg-card/70 p-3 transition-colors hover:bg-[var(--analytics-surface)]"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      {fb.isHelpful ? (
                        <ThumbsUp className="h-3.5 w-3.5 text-foreground" />
                      ) : (
                        <ThumbsDown className="h-3.5 w-3.5 text-[var(--analytics-ink-soft)]" />
                      )}
                      <span className="text-xs font-medium text-foreground">{fb.documentTitle}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {fb.comment && (
                      <p className="text-sm leading-relaxed text-muted-foreground">{fb.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
