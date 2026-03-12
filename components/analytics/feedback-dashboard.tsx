'use client'

import { useCallback, useEffect, useState } from 'react'
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
      <p className="py-10 text-center text-sm text-muted-foreground">
        Failed to load feedback analytics.
      </p>
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
    ratio: r.ratio,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Feedback Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Understand how helpful your documentation is to readers.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold tabular-nums">{totalFeedback}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Helpfulness Ratio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              <span className="text-2xl font-bold tabular-nums text-emerald-600">
                {(overallRatio * 100).toFixed(1)}%
              </span>
            </div>
            <Progress value={overallRatio * 100} className="h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Documents Rated</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold tabular-nums">{data.ranking.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Feedback by Document (Worst First)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="helpful" stackId="a" fill="oklch(0.72 0.17 155)" name="Helpful" />
                <Bar dataKey="notHelpful" stackId="a" fill="oklch(0.65 0.2 15)" name="Not Helpful" />
              </BarChart>
            </ResponsiveContainer>
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
                    <TableHead className="text-right">👍</TableHead>
                    <TableHead className="text-right">👎</TableHead>
                    <TableHead className="text-right">Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ranking.map((r) => (
                    <TableRow key={r.documentId}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {r.title}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {r.helpful}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-rose-600">
                        {r.notHelpful}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            'tabular-nums',
                            r.ratio >= 0.7
                              ? 'border-emerald-300 text-emerald-700'
                              : r.ratio >= 0.4
                                ? 'border-amber-300 text-amber-700'
                                : 'border-rose-300 text-rose-700',
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
              <div className="space-y-4">
                {data.recentComments.map((fb) => (
                  <div key={fb.id} className="rounded-md border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      {fb.isHelpful ? (
                        <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <ThumbsDown className="h-3.5 w-3.5 text-rose-600" />
                      )}
                      <span className="text-xs font-medium">{fb.documentTitle}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{fb.comment}</p>
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
