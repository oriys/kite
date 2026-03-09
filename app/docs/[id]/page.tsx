'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { type DocStatus } from '@/lib/documents'
import { useDocument } from '@/hooks/use-documents'
import { Input } from '@/components/ui/input'
import { DocEditor } from '@/components/docs/doc-editor'
import { DocStatusBar } from '@/components/docs/doc-status-bar'
import { Skeleton } from '@/components/ui/skeleton'

export default function DocEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { doc, loading, update, transition, remove, duplicate } = useDocument(params.id)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [initialized, setInitialized] = React.useState(false)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize local state from doc
  React.useEffect(() => {
    if (doc && !initialized) {
      setTitle(doc.title)
      setContent(doc.content)
      setInitialized(true)
    }
  }, [doc, initialized])

  // Auto-save with debounce
  const scheduleAutoSave = React.useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        update({ title: newTitle, content: newContent })
      }, 800)
    },
    [update],
  )

  // Cleanup timer
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
    // Flush any pending save
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
    if (newDoc) router.push(`/docs/${newDoc.id}`)
  }

  if (loading || !doc) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Skeleton className="mb-4 h-10 w-2/3" />
        <Skeleton className="h-[600px] w-full rounded-md" />
      </div>
    )
  }

  const isReadOnly = doc.status === 'published' || doc.status === 'archived'

  return (
    <div className="flex h-dvh flex-col">
      {/* Title bar */}
      <div className="border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-5xl">
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

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-5xl px-4 py-4 sm:px-6">
          <DocEditor
            content={content}
            onChange={handleContentChange}
            readOnly={isReadOnly}
            className="h-full"
          />
        </div>
      </div>

      {/* Status bar */}
      <DocStatusBar
        doc={{ ...doc, title, content }}
        onTransition={handleTransition}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    </div>
  )
}
