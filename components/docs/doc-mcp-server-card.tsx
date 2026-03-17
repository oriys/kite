import { PencilLine, Trash2, Plug, Loader2 } from 'lucide-react'

import type { McpServerConfigListItem } from '@/lib/mcp-server-config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface McpServerCardProps {
  server: McpServerConfigListItem
  onEdit: (server: McpServerConfigListItem) => void
  onDelete: (server: McpServerConfigListItem) => void
  onToggle: (server: McpServerConfigListItem, enabled: boolean) => void
  onTest: (server: McpServerConfigListItem) => void
  mutating: boolean
  testing: boolean
}

export function McpServerCard({
  server,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  mutating,
  testing,
}: McpServerCardProps) {
  const endpoint =
    server.transportType === 'stdio'
      ? server.command || 'No command configured'
      : server.url || 'No URL configured'

  return (
    <article className="rounded-xl border border-border/70 bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {server.name}
            </h3>
            <Badge variant="outline">{server.transportLabel}</Badge>
            <Badge variant={server.enabled ? 'secondary' : 'outline'}>
              {server.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {endpoint}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTest(server)}
            disabled={mutating || testing}
          >
            {testing ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Plug data-icon="inline-start" />
            )}
            Test
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(server)}
          >
            <PencilLine data-icon="inline-start" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(server)}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {server.transportType === 'stdio' ? (
          <>
            {server.argsCount > 0 ? (
              <Badge variant="outline">{server.argsCount} args</Badge>
            ) : null}
            {server.envCount > 0 ? (
              <Badge variant="outline">{server.envCount} env vars</Badge>
            ) : null}
          </>
        ) : (
          <>
            {server.headersCount > 0 ? (
              <Badge variant="outline">{server.headersCount} headers</Badge>
            ) : null}
          </>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {server.enabled
          ? 'This MCP server provides tools, prompts, and resources to the AI assistant.'
          : 'This MCP server is saved but disabled. Enable it to expose its capabilities to the AI.'}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
        <div>
          <p className="text-xs font-medium text-foreground">Enable server</p>
          <p className="text-xs text-muted-foreground">
            Disable a server without deleting its configuration.
          </p>
        </div>
        <Switch
          checked={server.enabled}
          onCheckedChange={(checked) => onToggle(server, checked)}
          aria-label={`Enable ${server.name}`}
          disabled={mutating}
        />
      </div>
    </article>
  )
}
