'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { type DocStatus } from '@/lib/documents'
import { cn } from '@/lib/utils'
import { getDocEditorHref } from '@/lib/docs-url'
import { useDocument } from '@/hooks/use-documents'
import { Input } from '@/components/ui/input'
import { DocEditor } from '@/components/docs/doc-editor'
import { DocStatusBar } from '@/components/docs/doc-status-bar'
import { type EditorViewMode } from '@/components/docs/doc-toolbar'

function getEditorShellClassName(mode: EditorViewMode) {
  return cn(
    'mx-auto w-full px-4 sm:px-6',
    mode === 'split' ? 'max-w-[1560px]' : 'max-w-5xl',
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
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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
      saveTimerRef.current = setTimeout(() => {
        update({ title: newTitle, content: newContent })
      }, 800)
    },
    [update],
  )

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
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

  const handleTransition = (status: DocStatus) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      update({ title, content })
    }
    transition(status)
  }

  const handleDelete = () => {
    remove()
    router.push('/docs')
  }

  const handleDuplicate = () => {
    const newDoc = duplicate()
    if (newDoc) router.push(getDocEditorHref(newDoc.id))
  }

  if (loading) {
    return null
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
            readOnly={isReadOnly}
            aria-label="Document title"
            placeholder="Untitled document…"
            className="border-0 bg-transparent px-0 text-lg font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className={cn(getEditorShellClassName(editorMode), 'h-full py-4')}>
          <DocEditor
            content={content}
            onChange={handleContentChange}
            readOnly={isReadOnly}
            className="h-full"
            onModeChange={setEditorMode}
          />
        </div>
      </div>

      <DocStatusBar
        doc={{ ...doc, title, content }}
        onTransition={handleTransition}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    </div>
  )
}
