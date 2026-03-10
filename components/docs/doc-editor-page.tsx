'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { type DocStatus, STATUS_CONFIG } from '@/lib/documents'
import { cn } from '@/lib/utils'
import { getDocEditorHref } from '@/lib/docs-url'
import { useDocument } from '@/hooks/use-documents'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DocEditor } from '@/components/docs/doc-editor'
import { DocStatusBar, type SaveState } from '@/components/docs/doc-status-bar'
import { type EditorViewMode } from '@/components/docs/doc-toolbar'

function getEditorShellClassName(mode: EditorViewMode) {
  return cn(
    'mx-auto w-full px-4 sm:px-6',
    mode === 'split' ? 'max-w-[1560px]' : 'max-w-5xl',
  )
}

function EditorSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Skeleton className="h-7 w-64" />
        </div>
      </div>
      <div className="flex-1 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-8 w-full" />
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 bg-muted/20 px-4 py-2">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </div>
  )
}

function MissingDocumentState() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border/70 bg-card p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Document not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a document from the list or create a new one first.
        </p>
        <button
          type="button"
          onClick={() => router.push('/docs')}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to Documents
        </button>
      </div>
    </div>
  )
}

export function DocEditorPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const docId = searchParams.get('doc')
  const { doc, loading, update, transition, remove, duplicate } = useDocument(docId)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [editorMode, setEditorMode] = React.useState<EditorViewMode>('wysiwyg')
  const [initialized, setInitialized] = React.useState(false)
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFeedbackRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorFocusRef = React.useRef<{ focus: () => void } | null>(null)

  React.useEffect(() => {
    if (doc && !initialized) {
      setTitle(doc.title)
      setContent(doc.content)
      setInitialized(true)
    }
  }, [doc, initialized])

  React.useEffect(() => {
    if (!docId) {
      setInitialized(false)
      setTitle('')
      setContent('')
      return
    }
  }, [docId])

  const scheduleAutoSave = React.useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current)
      setSaveState('saving')
      saveTimerRef.current = setTimeout(async () => {
        await update({ title: newTitle, content: newContent })
        setSaveState('saved')
        savedFeedbackRef.current = setTimeout(() => setSaveState('idle'), 2000)
      }, 800)
    },
    [update],
  )

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current)
    }
  }, [])

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    scheduleAutoSave(newTitle, content)
  }

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    scheduleAutoSave(title, newContent)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      editorFocusRef.current?.focus()
    }
  }

  const handleTransition = async (status: DocStatus) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      await update({ title, content })
    }
    await transition(status)
    const config = STATUS_CONFIG[status]
    toast.success(`Moved to ${config.label}`, {
      description: `"${title || 'Untitled'}" is now ${config.label.toLowerCase()}.`,
    })
  }

  const handleDelete = async () => {
    await remove()
    router.push('/docs')
    toast.success('Document deleted')
  }

  const handleDuplicate = async () => {
    const newDoc = await duplicate()
    if (newDoc) {
      router.push(getDocEditorHref(newDoc.id))
      toast.success('Document duplicated', {
        description: `Created "${newDoc.title}".`,
      })
    }
  }

  if (loading) {
    return <EditorSkeleton />
  }

  if (!docId || !doc) {
    return <MissingDocumentState />
  }

  const isReadOnly = doc.status === 'published' || doc.status === 'archived'

  return (
    <div className="flex h-dvh flex-col">
      <div className="border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
        <div className={getEditorShellClassName(editorMode)}>
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            readOnly={isReadOnly}
            aria-label="Document title"
            placeholder="Untitled document…"
            className="border-0 bg-transparent px-0 text-lg font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
          />
        </div>
      </div>

      {isReadOnly && (
        <div className="border-b border-amber-500/20 bg-amber-50/50 px-4 py-1.5 dark:bg-amber-950/20 sm:px-6">
          <div className={getEditorShellClassName(editorMode)}>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This document is {doc.status}. Revert to draft to make changes.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <div className={cn(getEditorShellClassName(editorMode), 'h-full py-4')}>
          <DocEditor
            content={content}
            onChange={handleContentChange}
            readOnly={isReadOnly}
            className="h-full"
            onModeChange={setEditorMode}
            editorFocusRef={editorFocusRef}
          />
        </div>
      </div>

      <DocStatusBar
        doc={{ ...doc, title, content }}
        saveState={saveState}
        onTransition={handleTransition}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    </div>
  )
}
