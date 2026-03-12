'use client'

import { LinkHealthDashboard } from '@/components/link-health-dashboard'

export default function LinkHealthPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Link Health
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor external links across your documentation for broken references.
        </p>
      </div>

      <LinkHealthDashboard />
    </div>
  )
}
