'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Bot, Check, RefreshCw, Sparkles, Trash2 } from 'lucide-react'

import { useSkills } from '@/hooks/use-skills'
import type { WorkspaceCliSkillListItem } from '@/lib/queries/skills'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

function SourceBadge({ sourceType }: { sourceType: string }) {
  return (
    <Badge variant="outline">
      {sourceType === 'github' ? 'GitHub' : sourceType}
    </Badge>
  )
}

function InstalledSkillCard({
  skill,
  mutating,
  onToggle,
  onDelete,
}: {
  skill: WorkspaceCliSkillListItem
  mutating: boolean
  onToggle: (skill: WorkspaceCliSkillListItem, enabled: boolean) => Promise<void>
  onDelete: (skill: WorkspaceCliSkillListItem) => Promise<void>
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{skill.name}</CardTitle>
              <SourceBadge sourceType={skill.sourceType} />
              <Badge variant={skill.enabled ? 'secondary' : 'outline'}>
                {skill.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <CardDescription>
              {skill.description || `CLI skill sourced from ${skill.source}.`}
            </CardDescription>
          </div>
          <Switch
            checked={skill.enabled}
            disabled={mutating}
            aria-label={`Toggle ${skill.name}`}
            onCheckedChange={(enabled) => void onToggle(skill, enabled)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="normal-case tracking-normal">
            {skill.slug}
          </Badge>
          <Badge variant="outline" className="normal-case tracking-normal">
            {skill.source}
          </Badge>
          {skill.computedHash ? (
            <Badge variant="outline" className="normal-case tracking-normal">
              {skill.computedHash.slice(0, 12)}…
            </Badge>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          variant="ghost"
          size="sm"
          disabled={mutating}
          onClick={() => void onDelete(skill)}
        >
          <Trash2 data-icon="inline-start" />
          Uninstall
        </Button>
      </CardFooter>
    </Card>
  )
}

export function DocSkillsManagerPage() {
  const {
    items,
    catalog,
    loading,
    mutating,
    error,
    refresh,
    installSkill,
    toggleSkill,
    uninstallSkill,
  } = useSkills()

  const handleInstall = React.useCallback(
    async (slug: string) => {
      try {
        await installSkill(slug)
        toast.success('CLI skill installed', {
          description: `${slug} will be available in newly created terminal sessions.`,
        })
      } catch (installError) {
        toast.error(
          installError instanceof Error
            ? installError.message
            : 'Failed to install CLI skill',
        )
      }
    },
    [installSkill],
  )

  const handleToggle = React.useCallback(
    async (skill: WorkspaceCliSkillListItem, enabled: boolean) => {
      try {
        await toggleSkill(skill.id, enabled)
        toast.success(enabled ? 'CLI skill enabled' : 'CLI skill disabled', {
          description: `${skill.name} will ${enabled ? 'appear' : 'be removed'} in newly created terminal sessions.`,
        })
      } catch (toggleError) {
        toast.error(
          toggleError instanceof Error
            ? toggleError.message
            : 'Failed to update CLI skill',
        )
      }
    },
    [toggleSkill],
  )

  const handleDelete = React.useCallback(
    async (skill: WorkspaceCliSkillListItem) => {
      try {
        await uninstallSkill(skill.id)
        toast.success('CLI skill uninstalled', {
          description: `${skill.name} will no longer be bootstrapped into new terminal sessions.`,
        })
      } catch (deleteError) {
        toast.error(
          deleteError instanceof Error
            ? deleteError.message
            : 'Failed to uninstall CLI skill',
        )
      }
    },
    [uninstallSkill],
  )

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              CLI Skills
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage the Copilot CLI skills bootstrapped into each new terminal
              session for this workspace.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || mutating}
            onClick={() => void refresh().catch(() => undefined)}
          >
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </div>

        <Alert>
          <Sparkles className="size-4" />
          <AlertTitle>Applies to new terminal sessions</AlertTitle>
          <AlertDescription>
            Skills are copied into a session-local <code>$COPILOT_HOME</code>{' '}
            during terminal bootstrap. Existing sessions keep their current
            environment.
          </AlertDescription>
        </Alert>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Catalog
          </h2>
          <Badge variant="outline">{catalog.length} available</Badge>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map((skill) => (
              <Card key={skill.slug} className="gap-3">
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{skill.name}</CardTitle>
                        <SourceBadge sourceType={skill.sourceType} />
                      </div>
                      <CardDescription>{skill.description}</CardDescription>
                    </div>
                    {skill.installed ? (
                      <Badge variant="secondary">
                        <Check className="size-3" />
                        Installed
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="normal-case tracking-normal">
                      {skill.slug}
                    </Badge>
                    <Badge variant="outline" className="normal-case tracking-normal">
                      {skill.source}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button
                    size="sm"
                    variant={skill.installed ? 'secondary' : 'outline'}
                    disabled={mutating || skill.installed}
                    onClick={() => void handleInstall(skill.slug)}
                  >
                    <Bot data-icon="inline-start" />
                    {skill.installed ? 'Installed' : 'Install'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Installed
          </h2>
          <Badge variant="outline">{items.length} configured</Badge>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 py-12 text-center">
            <Bot className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No CLI skills installed
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
              Install skills from the catalog to make them available in newly
              bootstrapped terminal sessions.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((skill) => (
              <InstalledSkillCard
                key={skill.id}
                skill={skill}
                mutating={mutating}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
