'use client'

import { FeatureGuard } from '@/components/docs/feature-guard'
import { LinkHealthDashboard } from '@/components/link-health-dashboard'

export default function LinkHealthPage() {
  return (
    <FeatureGuard featureId="linkHealth">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <LinkHealthDashboard />
      </div>
    </FeatureGuard>
  )
}
