'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { type DocStatus, STATUS_CONFIG } from '@/lib/documents'
import { useDocuments } from '@/hooks/use-documents'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { DocList } from '@/components/docs/doc-list'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const statuses: (DocStatus | 'all')[] = ['all', 'draft', 'review', 'published', 'archived']

export default function DocsPage() {
  const router = useRouter()
  const [filter, setFilter] = React.useState<DocStatus | 'all'>('all')
  const { items, loading, create, remove } = useDocuments(
    filter === 'all' ? undefined : filter,
  )
  const [newTitle, setNewTitle] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // Count per status (always from full list)
  const allDocs = useDocuments()
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: allDocs.items.length }
    for (const s of Object.keys(STATUS_CONFIG)) {
      c[s] = allDocs.items.filter((d) => d.status === s).length
    }
    return c
  }, [allDocs.items])

  const handleCreate = () => {
    const title = newTitle.trim() || 'Untitled'
    const doc = create(title, '')
    setNewTitle('')
    setDialogOpen(false)
    router.push(`/docs/${doc.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, review, and publish your API documentation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8">
                <Plus className="mr-1.5 size-3.5" />
                New Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Document</DialogTitle>
                <DialogDescription>
                  Give your document a title. You can change it later.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Document title…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              filter === s
                ? 'bg-accent/50 text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            <Badge variant="secondary" className="ml-0.5 h-4 min-w-[1rem] px-1 text-[10px]">
              {counts[s] ?? 0}
            </Badge>
          </button>
        ))}
      </div>

      {/* Document grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="size-5 motion-safe:animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        </div>
      ) : (
        <DocList documents={items} onDelete={remove} />
      )}
    </div>
  )
}
