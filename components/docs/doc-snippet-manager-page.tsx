'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  Blocks,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'

import {
  DOC_SNIPPET_CATEGORIES,
  getDocSnippetSearchValue,
  normalizeDocSnippetKeywords,
  type DocSnippetCategory,
  type DocSnippetMutation,
  type StoredDocSnippet,
} from '@/lib/doc-snippets'
import { useDocSnippets } from '@/hooks/use-doc-snippets'
import { cn } from '@/lib/utils'
import { DocsAdminShell } from '@/components/docs/docs-admin-shell'
import { MarkdownPreview } from '@/components/docs/markdown-preview'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type CategoryFilter = DocSnippetCategory | 'all'
type FormMode = 'create' | 'edit'

interface SnippetFormState {
  id: string | null
  label: string
  description: string
  category: DocSnippetCategory
  keywords: string
  template: string
}

const numberFormatter = new Intl.NumberFormat('en-US')

function createEmptyFormState(): SnippetFormState {
  return {
    id: null,
    label: '',
    description: '',
    category: DOC_SNIPPET_CATEGORIES[0],
    keywords: '',
    template: '',
  }
}

function createFormState(snippet: StoredDocSnippet): SnippetFormState {
  return {
    id: snippet.id,
    label: snippet.label,
    description: snippet.description,
    category: snippet.category,
    keywords: snippet.keywords.join(', '),
    template: snippet.template,
  }
}

function formatUpdatedAt(value: string) {
  if (!value) return 'Unsynced'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unsynced'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getCategoryCount(snippets: StoredDocSnippet[], category: DocSnippetCategory) {
  return snippets.filter((snippet) => snippet.category === category).length
}

function getSnippetMutation(form: SnippetFormState): DocSnippetMutation {
  return {
    label: form.label.trim(),
    description: form.description.trim(),
    category: form.category,
    keywords: normalizeDocSnippetKeywords(form.keywords),
    template: form.template.trim(),
  }
}

export function DocSnippetManagerPage() {
  const { items, loading, error, create, update, remove, refresh } = useDocSnippets()
  const [search, setSearch] = React.useState('')
  const deferredSearch = React.useDeferredValue(search)
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('all')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [formMode, setFormMode] = React.useState<FormMode>('create')
  const [formOpen, setFormOpen] = React.useState(false)
  const [formState, setFormState] = React.useState<SnippetFormState>(() => createEmptyFormState())
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<StoredDocSnippet | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const filteredItems = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()

    return items.filter((snippet) => {
      if (categoryFilter !== 'all' && snippet.category !== categoryFilter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return getDocSnippetSearchValue(snippet).toLowerCase().includes(normalizedSearch)
    })
  }, [categoryFilter, deferredSearch, items])

  React.useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedId(null)
      return
    }

    if (!selectedId || !filteredItems.some((snippet) => snippet.id === selectedId)) {
      setSelectedId(filteredItems[0].id)
    }
  }, [filteredItems, selectedId])

  const selectedSnippet =
    filteredItems.find((snippet) => snippet.id === selectedId) ??
    items.find((snippet) => snippet.id === selectedId) ??
    null

  const totalSnippetCount = numberFormatter.format(items.length)
  const categoryCount = numberFormatter.format(
    DOC_SNIPPET_CATEGORIES.filter((category) => getCategoryCount(items, category) > 0).length,
  )
  const latestUpdate =
    [...items]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .at(0)?.updatedAt ?? ''

  const openCreateDialog = React.useCallback(() => {
    setFormMode('create')
    setFormError(null)
    setFormState(createEmptyFormState())
    setFormOpen(true)
  }, [])

  const openEditDialog = React.useCallback((snippet: StoredDocSnippet) => {
    setFormMode('edit')
    setFormError(null)
    setFormState(createFormState(snippet))
    setFormOpen(true)
  }, [])

  const handleFormSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setIsSubmitting(true)
      setFormError(null)

      try {
        const payload = getSnippetMutation(formState)

        if (!payload.label || !payload.description || !payload.template) {
          throw new Error('Label, description, and template are required')
        }

        const saved =
          formMode === 'create'
            ? await create(payload)
            : await update(formState.id ?? '', payload)

        setSelectedId(saved.id)
        setFormOpen(false)
        toast.success(formMode === 'create' ? 'Component created' : 'Component updated', {
          description: saved.label,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save component'
        setFormError(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [create, formMode, formState, update],
  )

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) {
      return
    }

    setIsDeleting(true)

    try {
      const deletedId = deleteTarget.id
      const deletedLabel = deleteTarget.label
      await remove(deletedId)

      setDeleteTarget(null)
      setSelectedId((current) => (current === deletedId ? null : current))
      toast.success('Component deleted', {
        description: deletedLabel,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete component')
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, remove])

  return (
    <DocsAdminShell
      kicker="Quick Insert"
      title="Keep the insert library small, clear, and easy to scan."
      description="Manage reusable markdown blocks without touching code, then preview exactly what the editor will insert before you ship changes."
      actions={(
        <>
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus data-icon="inline-start" />
            New component
          </Button>
        </>
      )}
      meta={(
        <>
          <Badge variant="outline">{totalSnippetCount} items</Badge>
          <Badge variant="outline">{categoryCount} active groups</Badge>
          <Badge variant="outline">
            {loading ? 'Syncing library' : `Last sync ${formatUpdatedAt(latestUpdate)}`}
          </Badge>
        </>
      )}
      notice={(
        <div className="grid gap-3">
          <Alert>
            <Sparkles />
            <AlertTitle>Live source for Insert</AlertTitle>
            <AlertDescription>
              Changes here feed the quick insert picker in the editor. Reopen the picker in
              any already-open tab to pull in the refreshed library.
            </AlertDescription>
          </Alert>
          {error ? (
            <Alert className="border-destructive/30">
              <Blocks />
              <AlertTitle>Library fallback is active</AlertTitle>
              <AlertDescription>
                {error}. The editor can still use the built-in defaults, but save and delete
                actions need the database-backed table available.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="editorial-surface overflow-hidden editorial-reveal">
          <div className="grid gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="flex flex-col gap-2">
                <p className="editorial-section-kicker">Search</p>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, category, or keywords"
                    aria-label="Search components"
                  />
                </InputGroup>
              </div>
              <div className="text-xs text-muted-foreground">
                {numberFormatter.format(filteredItems.length)} visible
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="editorial-section-kicker">Category</p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setCategoryFilter('all')}
                >
                  Clear filter
                </button>
              </div>
              <div className="overflow-x-auto pb-1">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={categoryFilter}
                  className="w-max rounded-xl border border-border/75 bg-card/80 p-1"
                  onValueChange={(value) => {
                    if (value) {
                      setCategoryFilter(value as CategoryFilter)
                    }
                  }}
                >
                  <ToggleGroupItem value="all" className="flex-none px-4 sm:px-5">
                    All
                  </ToggleGroupItem>
                  {DOC_SNIPPET_CATEGORIES.map((category) => (
                    <ToggleGroupItem
                      key={category}
                      value={category}
                      className="flex-none px-4 sm:px-5"
                    >
                      {category}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-3">
            {filteredItems.length === 0 ? (
              <Empty className="min-h-[320px]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Blocks />
                  </EmptyMedia>
                  <EmptyTitle>No matching components</EmptyTitle>
                  <EmptyDescription>
                    Adjust the search or filter, or create a new quick insert component.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreateDialog}>
                    <Plus data-icon="inline-start" />
                    Create component
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((snippet) => {
                  const isSelected = selectedId === snippet.id

                  return (
                    <article
                      key={snippet.id}
                      className={cn(
                        'grid gap-3 rounded-xl border border-border/75 bg-card/70 p-3 transition-colors md:grid-cols-[minmax(0,1fr)_auto] md:items-start',
                        isSelected
                          ? 'border-primary/40 bg-primary/[0.06]'
                          : 'hover:bg-muted/25',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(snippet.id)}
                        className="min-w-0 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                            {snippet.label}
                          </span>
                          <Badge variant="outline">{snippet.category}</Badge>
                          {isSelected ? <Badge variant="secondary">Selected</Badge> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {snippet.description}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Updated {formatUpdatedAt(snippet.updatedAt)}</span>
                          <span>{snippet.keywords.length} keywords</span>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(snippet)}
                        >
                          <PencilLine data-icon="inline-start" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(snippet)}
                        >
                          <Trash2 data-icon="inline-start" />
                          Delete
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="editorial-reveal xl:sticky xl:top-4 xl:self-start">
          <section className="editorial-surface overflow-hidden">
            {selectedSnippet ? (
              <>
                <div className="border-b border-border/70 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="editorial-section-kicker">Selection</p>
                      <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                        {selectedSnippet.label}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedSnippet.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(selectedSnippet)}
                      >
                        <PencilLine data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(selectedSnippet)}
                      >
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{selectedSnippet.category}</Badge>
                    <Badge variant="secondary">
                      {selectedSnippet.keywords.length} keywords
                    </Badge>
                    <Badge variant="outline">
                      Updated {formatUpdatedAt(selectedSnippet.updatedAt)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  {selectedSnippet.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedSnippet.keywords.map((keyword) => (
                        <Badge key={keyword} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-border/75 bg-muted/20 p-4">
                    <p className="editorial-section-kicker">Rendered preview</p>
                    <MarkdownPreview
                      content={selectedSnippet.template}
                      className="mt-3 min-h-[220px] max-w-none"
                    />
                  </div>

                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel htmlFor="snippet-source">Markdown source</FieldLabel>
                      <Textarea
                        id="snippet-source"
                        readOnly
                        value={selectedSnippet.template}
                        className="min-h-[220px] font-mono text-[13px] leading-6"
                      />
                      <FieldDescription>
                        Editing uses raw markdown so the Insert action stays predictable.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </div>
              </>
            ) : (
              <Empty className="min-h-[420px]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Blocks />
                  </EmptyMedia>
                  <EmptyTitle>Select a component</EmptyTitle>
                  <EmptyDescription>
                    Pick an item from the library to inspect its rendered output and raw
                    markdown template.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>
        </aside>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-3xl">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle>
                {formMode === 'create' ? 'Create quick insert component' : 'Edit quick insert component'}
              </DialogTitle>
              <DialogDescription>
                Keep the title scannable, the description specific, and the markdown template
                copy-ready.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[70vh] overflow-y-auto py-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="component-label">Label</FieldLabel>
                  <FieldContent>
                    <InputGroup>
                      <InputGroupInput
                        id="component-label"
                        value={formState.label}
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, label: event.target.value }))
                        }
                        placeholder="Release Notes"
                        aria-invalid={Boolean(formError && !formState.label.trim())}
                      />
                    </InputGroup>
                    <FieldDescription>
                      This is the primary title shown in the Insert picker.
                    </FieldDescription>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="component-description">Description</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="component-description"
                      value={formState.description}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Capture added, changed, and next steps in a compact changelog block."
                      className="min-h-24"
                      aria-invalid={Boolean(formError && !formState.description.trim())}
                    />
                    <FieldDescription>
                      One sentence that helps someone choose the right component quickly.
                    </FieldDescription>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="component-category">Category</FieldLabel>
                  <FieldContent>
                    <Select
                      value={formState.category}
                      onValueChange={(value) =>
                        setFormState((current) => ({
                          ...current,
                          category: value as DocSnippetCategory,
                        }))
                      }
                    >
                      <SelectTrigger id="component-category" className="w-full">
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {DOC_SNIPPET_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Categories drive grouping inside the picker and keep the library readable.
                    </FieldDescription>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="component-keywords">Keywords</FieldLabel>
                  <FieldContent>
                    <InputGroup>
                      <InputGroupInput
                        id="component-keywords"
                        value={formState.keywords}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            keywords: event.target.value,
                          }))
                        }
                        placeholder="release, changelog, ship"
                      />
                    </InputGroup>
                    <FieldDescription>
                      Separate keywords with commas. They power picker search and shortcuts.
                    </FieldDescription>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="component-template">Markdown Template</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="component-template"
                      value={formState.template}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          template: event.target.value,
                        }))
                      }
                      className="min-h-[280px] font-mono text-[13px] leading-6"
                      placeholder="## Release Notes"
                      aria-invalid={Boolean(formError && !formState.template.trim())}
                    />
                    <FieldDescription>
                      This markdown is inserted directly into the document editor.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>

              {formError ? (
                <p className="mt-4 text-sm text-destructive">{formError}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? formMode === 'create'
                    ? 'Creating…'
                    : 'Saving…'
                  : formMode === 'create'
                    ? 'Create Component'
                    : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quick insert component?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.label}” will be removed from the Insert picker for this workspace.`
                : 'This component will be removed from the Insert picker.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete Component'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DocsAdminShell>
  )
}
