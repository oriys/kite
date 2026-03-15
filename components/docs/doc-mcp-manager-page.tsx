'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Cable, Plus } from 'lucide-react'

import {
  createDefaultMcpServerFormValues,
  type McpServerFormValues,
} from '@/lib/ai'
import type { McpServerConfigListItem } from '@/lib/queries/mcp'
import { useMcpServers } from '@/hooks/use-mcp-servers'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { McpServerCard } from './doc-mcp-server-card'
import { McpServerFormDialog } from './doc-mcp-server-form-dialog'

export function DocMcpManagerPage() {
  const {
    items,
    loading,
    mutating,
    error: listError,
    createServer,
    updateServer,
    deleteServer,
    toggleServer,
    testConnection,
  } = useMcpServers()

  // Form state
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create')
  const [editingServerId, setEditingServerId] = React.useState<string | null>(
    null,
  )
  const [formValues, setFormValues] = React.useState<McpServerFormValues>(
    createDefaultMcpServerFormValues(),
  )
  const [formError, setFormError] = React.useState<string | null>(null)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] =
    React.useState<McpServerConfigListItem | null>(null)

  // Test connection state
  const [testingId, setTestingId] = React.useState<string | null>(null)

  // -- Handlers --

  function openCreateForm() {
    setFormMode('create')
    setEditingServerId(null)
    setFormValues(createDefaultMcpServerFormValues())
    setFormError(null)
    setFormOpen(true)
  }

  function openEditForm(server: McpServerConfigListItem) {
    setFormMode('edit')
    setEditingServerId(server.id)
    setFormValues({
      name: server.name,
      transportType: server.transportType,
      command: server.command,
      args: server.args.length > 0 ? server.args.join('\n') : '',
      env:
        Object.keys(server.env).length > 0
          ? Object.entries(server.env)
              .map(([k, v]) => `${k}=${v}`)
              .join('\n')
          : '',
      url: server.url,
      headers:
        Object.keys(server.headers).length > 0
          ? Object.entries(server.headers)
              .map(([k, v]) => `${k}=${v}`)
              .join('\n')
          : '',
      enabled: server.enabled,
    })
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    try {
      if (formMode === 'create') {
        await createServer(formValues)
        toast.success('MCP server added')
      } else if (editingServerId) {
        await updateServer(editingServerId, formValues)
        toast.success('MCP server updated')
      }
      setFormOpen(false)
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : 'An unexpected error occurred',
      )
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteServer(deleteTarget.id)
      toast.success(`"${deleteTarget.name}" deleted`)
    } catch {
      toast.error('Failed to delete MCP server')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleToggle(
    server: McpServerConfigListItem,
    enabled: boolean,
  ) {
    try {
      await toggleServer(server.id, enabled)
      toast.success(enabled ? 'MCP server enabled' : 'MCP server disabled')
    } catch {
      toast.error('Failed to update MCP server')
    }
  }

  async function handleTest(server: McpServerConfigListItem) {
    setTestingId(server.id)
    try {
      const result = await testConnection(server.id)
      if (result.ok) {
        const parts: string[] = []
        if (result.toolCount > 0) {
          parts.push(`${result.toolCount} tool${result.toolCount === 1 ? '' : 's'}`)
        }
        if (result.promptCount > 0) {
          parts.push(`${result.promptCount} prompt${result.promptCount === 1 ? '' : 's'}`)
        }
        if (result.resourceCount > 0) {
          parts.push(`${result.resourceCount} resource${result.resourceCount === 1 ? '' : 's'}`)
        }
        toast.success(
          parts.length > 0
            ? `Connected — ${parts.join(', ')}`
            : 'Connected (no capabilities exposed)',
        )
      } else {
        toast.error(result.error ?? 'Connection test failed')
      }
    } catch {
      toast.error('Connection test failed')
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          MCP Servers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect external MCP servers to give the AI assistant access to
          databases, file systems, APIs, and other tools.
        </p>
      </div>

      {/* Error banner */}
      {listError ? (
        <Alert variant="destructive">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Server list */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Servers
          </h2>
          <Button variant="outline" size="sm" onClick={openCreateForm}>
            <Plus data-icon="inline-start" />
            Add Server
          </Button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 py-12 text-center">
            <Cable className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No MCP servers configured
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
              Add an MCP server to enable the AI assistant to call external
              tools during conversations.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={openCreateForm}
            >
              <Plus data-icon="inline-start" />
              Add Server
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((server) => (
              <McpServerCard
                key={server.id}
                server={server}
                onEdit={openEditForm}
                onDelete={setDeleteTarget}
                onToggle={handleToggle}
                onTest={handleTest}
                mutating={mutating}
                testing={testingId === server.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Form dialog */}
      <McpServerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        values={formValues}
        onValuesChange={setFormValues}
        onSubmit={handleSubmit}
        error={formError}
        mutating={mutating}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MCP server?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be permanently removed.
              The AI assistant will no longer have access to its tools.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={mutating}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {mutating ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
