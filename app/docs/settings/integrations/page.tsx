import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { IntegrationsSettings } from '@/components/settings/integrations-settings'

export const metadata: Metadata = {
  title: 'Integrations — Settings',
  description: 'Connect Slack, GitHub, and Jira to your workspace.',
}

export default async function IntegrationsSettingsPage() {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) {
    if (result.error.status === 401) redirect('/auth/signin')
    redirect('/docs')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Integrations
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Connect third-party services to automate workflows and keep your
          team in sync across Slack, GitHub, and Jira.
        </p>
      </div>

      <IntegrationsSettings workspaceId={result.ctx.workspaceId} />
    </div>
  )
}
