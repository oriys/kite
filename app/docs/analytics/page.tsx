'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchAnalyticsDashboard } from '@/components/analytics/search-analytics-dashboard'
import { FeedbackDashboard } from '@/components/analytics/feedback-dashboard'
import { BarChart3, MessageSquare } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search usage and reader feedback across your documentation.
        </p>
      </div>

      <Tabs defaultValue="search" className="space-y-6">
        <TabsList>
          <TabsTrigger value="search" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            Search Analytics
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5">
            <MessageSquare className="size-3.5" />
            Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <SearchAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="feedback">
          <FeedbackDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
