'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchAnalyticsDashboard } from '@/components/analytics/search-analytics-dashboard'
import { FeedbackDashboard } from '@/components/analytics/feedback-dashboard'
import { PageAnalyticsDashboard } from '@/components/analytics/page-analytics-dashboard'
import { FeatureGuard } from '@/components/docs/feature-guard'
import { BarChart3, MessageSquare, Eye } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <FeatureGuard featureId="analytics">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search usage, reader feedback, and page views across your documentation.
          </p>
        </div>

        <Tabs defaultValue="search" className="space-y-6">
          <TabsList>
            <TabsTrigger value="search" className="gap-1.5">
              <BarChart3 className="size-3.5" />
              Search
            </TabsTrigger>
            <TabsTrigger value="feedback" className="gap-1.5">
              <MessageSquare className="size-3.5" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="pageviews" className="gap-1.5">
              <Eye className="size-3.5" />
              Page Views
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            <SearchAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="feedback">
            <FeedbackDashboard />
          </TabsContent>

          <TabsContent value="pageviews">
            <PageAnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGuard>
  )
}
