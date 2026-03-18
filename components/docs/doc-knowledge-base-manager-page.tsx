'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { BookOpen, Plus } from 'lucide-react'

import {
  createDefaultKnowledgeSourceFormValues,
  useKnowledgeSources,
  type KnowledgeSourceFormValues,
  type KnowledgeSourceItem,
} from '@/hooks/use-knowledge-sources'
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
import { KnowledgeSourceCard } from './doc-knowledge-source-card'
import { KnowledgeSourceFormDialog } from './doc-knowledge-source-form-dialog'

export function DocKnowledgeBaseManagerPage() {
  const {
    items,
    loading,
    mutating,
    error: listError,
    createSource,
    updateSource,
    deleteSource,
    processSource,
    stopSource,
  } = useKnowledgeSources()

  // Form state
  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create')
  const [editingSourceId, setEditingSourceId] = React.useState<string | null>(null)
  const [formValues, setFormValues] = React.useState<KnowledgeSourceFormValues>(
    createDefaultKnowledgeSourceFormValues(),
  )
  const [formError, setFormError] = React.useState<string | null>(null)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = React.useState<KnowledgeSourceItem | null>(null)

  // Processing state
  const [processingIds, setProcessingIds] = React.useState<Set<string>>(() => new Set())
  const [stoppingIds, setStoppingIds] = React.useState<Set<string>>(() => new Set())

  // -- Handlers --

  function openCreateForm() {
    setFormMode('create')
    setEditingSourceId(null)
    setFormValues(createDefaultKnowledgeSourceFormValues())
    setFormError(null)
    setFormOpen(true)
  }

  function openEditForm(source: KnowledgeSourceItem) {
    setFormMode('edit')
    setEditingSourceId(source.id)
    setFormValues({
      title: source.title,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl ?? '',
      rawContent: source.rawContent ?? '',
      file: null,
    })
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    try {
      if (formMode === 'create') {
        await createSource(formValues)
        toast.success('Knowledge source added')
      } else if (editingSourceId) {
        await updateSource(editingSourceId, formValues)
        toast.success('Knowledge source updated')
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
      await deleteSource(deleteTarget.id)
      toast.success(`"${deleteTarget.title}" deleted`)
    } catch {
      toast.error('Failed to delete knowledge source')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleProcess(source: KnowledgeSourceItem) {
    setProcessingIds((prev) => new Set(prev).add(source.id))
    try {
      const result = await processSource(source.id)
      if (result.status === 'ready') {
        toast.success(
          `Processed — ${result.chunkCount} chunk${result.chunkCount === 1 ? '' : 's'} indexed`,
        )
      } else if (result.status === 'cancelled') {
        toast.info(`Stopped "${source.title}"`)
      } else {
        toast.info(`Processing status: ${result.status}`)
      }
    } catch {
      toast.error('Failed to process knowledge source')
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(source.id)
        return next
      })
    }
  }

  async function handleStop(source: KnowledgeSourceItem) {
    setStoppingIds((prev) => new Set(prev).add(source.id))
    try {
      await stopSource(source.id)
      toast.info(`Stopping "${source.title}"…`)
    } catch {
      toast.error('Failed to stop knowledge source processing')
    } finally {
      setStoppingIds((prev) => {
        const next = new Set(prev)
        next.delete(source.id)
        return next
      })
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Knowledge Base
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add documents, URLs, and FAQ content that the AI assistant can
          reference during conversations.
        </p>
      </div>

      {/* Error banner */}
      {listError ? (
        <Alert variant="destructive">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Source list */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sources
          </h2>
          <Button variant="outline" size="sm" onClick={openCreateForm}>
            <Plus data-icon="inline-start" />
            Add Source
          </Button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 py-12 text-center">
            <BookOpen className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No knowledge sources configured
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
              Add content to build a knowledge base that the AI assistant can
              search during conversations.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={openCreateForm}
            >
              <Plus data-icon="inline-start" />
              Add Source
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((source) => (
              <KnowledgeSourceCard
                key={source.id}
                source={source}
                onEdit={openEditForm}
                onDelete={setDeleteTarget}
                onProcess={handleProcess}
                onStop={handleStop}
                mutating={mutating}
                processing={processingIds.has(source.id)}
                stopping={stoppingIds.has(source.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Form dialog */}
      <KnowledgeSourceFormDialog
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
            <AlertDialogTitle>Delete knowledge source?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently removed.
              All indexed content from this source will be deleted.
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
