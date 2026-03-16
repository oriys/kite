import type { Metadata } from 'next'
import { IntegrationsSettings } from '@/components/settings/integrations-settings'
import { requireWorkspacePageAuth } from '@/lib/workspace-page-auth'

export const metadata: Metadata = {
  title: 'Integrations — Settings',
  description: 'Connect Slack, GitHub, and Jira to your workspace.',
}

export default async function IntegrationsSettingsPage() {
  const ctx = await requireWorkspacePageAuth('admin')

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

      <IntegrationsSettings workspaceId={ctx.workspaceId} />
    </div>
  )
}
