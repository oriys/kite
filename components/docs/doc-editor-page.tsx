'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { REVIEW_READ_ONLY_AI_ACTIONS } from '@/lib/ai'
import {
  isDocumentTitleMissing,
  type DocStatus,
  STATUS_CONFIG,
} from '@/lib/documents'
import {
  clearPendingDocumentSummary,
  queuePendingDocumentSummary,
} from '@/lib/document-summary-queue'
import { cn } from '@/lib/utils'
import { MessageSquare } from 'lucide-react'
import { getDocEditorHref } from '@/lib/documents'
import type { CommentSelection } from '@/lib/editor/editor-helpers'
import { clampDocEditorWidth } from '@/lib/doc-editor-layout'
import { useDocEditorAiPanelSide } from '@/hooks/use-doc-editor-ai-panel-side'
import { useDocument } from '@/hooks/use-documents'
import { useDocEditorWidth } from '@/hooks/use-doc-editor-width'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DocEditor,
  type DocEditorHandle,
} from '@/components/docs/doc-editor'
import { EditorErrorBoundary } from '@/components/docs/editor-error-boundary'
import { DocStatusBar, type SaveState } from '@/components/docs/doc-status-bar'
import { type EditorViewMode } from '@/components/docs/doc-toolbar'
import { DocCommentSidebar } from '@/components/docs/doc-comment-sidebar'
import { VisibilitySelector } from '@/components/visibility-selector'
import { VisibilityBadge } from '@/components/visibility-badge'
import { DocFeedback } from '@/components/doc-feedback'
import { ExportMenu } from '@/components/export-menu'
import { PresenceAvatars } from '@/components/presence-avatars'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { DocumentPermissionsDialog } from '@/components/docs/document-permissions-dialog'

function getEditorShellClassName(resizing = false) {
  return cn(
    'mx-auto w-full px-4 motion-reduce:transition-none sm:px-6',
    !resizing && 'transition-[max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
  )
}

function getEditorShellStyle(documentWidth: number) {
  return {
    maxWidth: `${clampDocEditorWidth(documentWidth)}px`,
  } satisfies React.CSSProperties
}

function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col">
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
  const { doc, loading, update, transition, remove, duplicate, refresh } = useDocument(docId)
  const [availableLocales, setAvailableLocales] = React.useState<
    { code: string; documentId?: string }[]
  >([])
  const [pendingLocale, setPendingLocale] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [, setEditorMode] = React.useState<EditorViewMode>('wysiwyg')
  const [documentResizeActive, setDocumentResizeActive] = React.useState(false)
  const [initializedDocId, setInitializedDocId] = React.useState<string | null>(null)
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [commentSidebarOpen, setCommentSidebarOpen] = React.useState(false)
  const [isEditorFullscreen, setIsEditorFullscreen] = React.useState(false)
  const [pendingComment, setPendingComment] = React.useState<CommentSelection | null>(null)
  const [visibility, setVisibility] = React.useState<'public' | 'partner' | 'private'>(
    doc?.visibility ?? 'private',
  )
  const [backBusy, setBackBusy] = React.useState(false)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFeedbackRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = React.useRef(0)
  const pendingSaveRef = React.useRef<{ title: string; content: string } | null>(null)
  const [, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const editorFocusRef = React.useRef<DocEditorHandle | null>(null)
  const editorOverlayRef = React.useRef<HTMLDivElement | null>(null)
  const { documentWidth, setDocumentWidth } = useDocEditorWidth()
  const { aiPanelSide, setAiPanelSide } = useDocEditorAiPanelSide()

  React.useEffect(() => {
    if (doc && initializedDocId !== doc.id) {
      setTitle(doc.title)
      setContent(doc.content)
      setVisibility(doc.visibility)
      setInitializedDocId(doc.id)
    }
  }, [doc, initializedDocId])

  React.useEffect(() => {
    if (!docId) {
      setInitializedDocId(null)
      setTitle('')
      setContent('')
      setAvailableLocales([])
      setPendingLocale(null)
      return
    }
    if (docId !== initializedDocId) {
      setInitializedDocId(null)
    }
  }, [docId, initializedDocId])

  React.useEffect(() => {
    const currentDocId = doc?.id

    if (!currentDocId) {
      setAvailableLocales([])
      return
    }

    let cancelled = false

    async function loadTranslations() {
      try {
        const response = await fetch(`/api/documents/${currentDocId}/translations`)
        if (!response.ok) {
          if (!cancelled) {
            setAvailableLocales([])
          }
          return
        }

        const data = (await response.json()) as {
          currentLocale: string
          translations: { locale: string; documentId: string }[]
        }

        if (cancelled) return

        setAvailableLocales(
          data.translations.map((translation) => ({
            code: translation.locale,
            documentId: translation.documentId,
          })),
        )
      } catch {
        if (!cancelled) {
          setAvailableLocales([])
        }
      }
    }

    void loadTranslations()

    return () => {
      cancelled = true
    }
  }, [doc?.id])

  // ── Online/offline detection ────────────────────────────────────────────

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Retry pending save when coming back online
      if (pendingSaveRef.current) {
        const { title: t, content: c } = pendingSaveRef.current
        retryCountRef.current = 0
        performSave(t, c)
      }
    }
    const handleOffline = () => {
      setIsOnline(false)
      setSaveState('offline')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-save with retry ──────────────────────────────────────────────────

  const performSave = React.useCallback(
    async (saveTitle: string, saveContent: string) => {
      if (!navigator.onLine) {
        pendingSaveRef.current = { title: saveTitle, content: saveContent }
        setSaveState('offline')
        return
      }

      setSaveState('saving')
      try {
        const updated = await update({ title: saveTitle, content: saveContent })
        if (!updated) {
          throw new Error('You no longer have permission to edit this document.')
        }

        pendingSaveRef.current = null
        retryCountRef.current = 0
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
        setSaveState('saved')
        savedFeedbackRef.current = setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        pendingSaveRef.current = { title: saveTitle, content: saveContent }
        retryCountRef.current += 1
        setSaveState('error')

        // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30_000)
        retryTimerRef.current = setTimeout(() => {
          if (pendingSaveRef.current) {
            void performSave(pendingSaveRef.current.title, pendingSaveRef.current.content)
          }
        }, delay)
      }
    },
    [update],
  )

  const scheduleAutoSave = React.useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current)
      pendingSaveRef.current = { title: newTitle, content: newContent }
      setSaveState('saving')
      saveTimerRef.current = setTimeout(() => {
        void performSave(newTitle, newContent)
      }, 800)
    },
    [performSave],
  )

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (!isEditorFullscreen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isEditorFullscreen])

  React.useEffect(() => {
    if (!isEditorFullscreen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEditorFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEditorFullscreen])

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
      const flushed = await update({ title, content })
      if (!flushed) {
        toast.error('Failed to save document before changing status')
        return
      }
    }
    const updated = await transition(status)
    if (!updated) {
      toast.error('Failed to update status', {
        description: 'You may not have permission to change this document.',
      })
      return
    }

    const config = STATUS_CONFIG[status]
    toast.success(`Moved to ${config.label}`, {
      description: `"${title || 'Untitled'}" is now ${config.label.toLowerCase()}.`,
    })
  }

  const handleDelete = async () => {
    const removed = await remove()
    if (!removed) {
      toast.error('Failed to delete document', {
        description: 'You may not have permission to delete this document.',
      })
      return
    }

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
      return
    }

    toast.error('Failed to duplicate document', {
      description: 'You may not have permission to duplicate this document.',
    })
  }

  const handleVisibilityChange = async (newVisibility: 'public' | 'partner' | 'private') => {
    if (!docId) return
    setVisibility(newVisibility)
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      })
      if (!res.ok) throw new Error('Failed to update visibility')
      toast.success(`Visibility set to ${newVisibility}`)
    } catch {
      setVisibility(visibility)
      toast.error('Failed to update visibility')
    }
  }

  const handleComment = React.useCallback((selection: CommentSelection) => {
    setPendingComment(selection)
    setCommentSidebarOpen(true)
  }, [])

  const handleCommentCreated = React.useCallback(
    (commentId: string, from: number, to: number) => {
      editorFocusRef.current?.applyCommentMark?.(from, to, commentId)
    },
    [],
  )

  const triggerDocumentSummaryRefresh = React.useCallback((documentId: string) => {
    queuePendingDocumentSummary(documentId)

    void fetch(`/api/documents/${documentId}/summary`, {
      method: 'POST',
      keepalive: true,
    })
      .then(async (response) => {
        if (response.ok) return

        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null

        throw new Error(payload?.error ?? 'Failed to generate summary')
      })
      .catch((error) => {
        clearPendingDocumentSummary(documentId)

        toast.error('Summary update failed', {
          description:
            error instanceof Error
              ? error.message
              : 'The list will fall back to the raw excerpt.',
        })
      })
  }, [])

  const handleBack = React.useCallback(async () => {
    if (!docId || backBusy) return

    setBackBusy(true)

    try {
      let latestDoc = doc
      const titleChanged = Boolean(doc && doc.title !== title)
      const contentChanged = Boolean(doc && doc.content !== content)

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        const flushed = await update({ title, content })
        if (!flushed) {
          throw new Error('Latest changes could not be saved before generating the summary.')
        }
        latestDoc = flushed
        setSaveState('saved')
      } else if (doc && (titleChanged || contentChanged)) {
        const flushed = await update({ title, content })
        if (!flushed) {
          throw new Error('Latest changes could not be saved before generating the summary.')
        }
        latestDoc = flushed
        setSaveState('saved')
      }

      const shouldRefreshSummary =
        Boolean(latestDoc?.content.trim()) &&
        (
          contentChanged ||
          !latestDoc?.summary ||
          isDocumentTitleMissing(latestDoc?.title)
        )

      if (shouldRefreshSummary) {
        triggerDocumentSummaryRefresh(docId)
      }
    } catch (error) {
      toast.error('Summary update failed', {
        description:
          error instanceof Error ? error.message : 'The list will fall back to the raw excerpt.',
      })
    } finally {
      router.push('/docs')
    }
  }, [backBusy, content, doc, docId, title, triggerDocumentSummaryRefresh, update, router])

  if (loading) {
    return <EditorSkeleton />
  }

  if (!docId || !doc) {
    return <MissingDocumentState />
  }

  const isPermissionReadOnly = !doc.canEdit
  const isStatusReadOnly = doc.status !== 'draft'
  const isReadOnly = isStatusReadOnly || isPermissionReadOnly
  const readOnlyAiActions = doc.status === 'review' ? REVIEW_READ_ONLY_AI_ACTIONS : undefined
  const editorShellStyle = isEditorFullscreen
    ? undefined
    : getEditorShellStyle(documentWidth)

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col',
        isEditorFullscreen &&
          'fixed inset-0 z-[70] h-[100dvh] overflow-hidden bg-background',
      )}
    >
      {!isEditorFullscreen ? (
        <div className="border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
          <div className={getEditorShellClassName(documentResizeActive)} style={editorShellStyle}>
            <div className="flex items-center gap-3">
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                readOnly={isReadOnly}
                aria-label="Document title"
                placeholder="Untitled document…"
                className="flex-1 border-0 bg-transparent px-0 text-lg font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
              />
              {isReadOnly || !doc.canManagePermissions ? (
                <VisibilityBadge visibility={visibility} className="shrink-0" />
              ) : (
                <VisibilitySelector
                  value={visibility}
                  onChange={handleVisibilityChange}
                  className="shrink-0"
                />
              )}
              <DocumentPermissionsDialog
                document={doc}
                className="shrink-0"
                onPermissionsChanged={refresh}
              />
              <ExportMenu documentId={doc.id} documentTitle={title} />
              <LocaleSwitcher
                currentLocale={doc.locale ?? 'en'}
                availableLocales={availableLocales}
                pendingLocale={pendingLocale}
                onLocaleChange={async (locale, targetDocumentId) => {
                  if (locale === (doc.locale ?? 'en')) {
                    return
                  }

                  if (targetDocumentId) {
                    router.push(getDocEditorHref(targetDocumentId))
                    return
                  }

                  setPendingLocale(locale)
                  try {
                    const response = await fetch(`/api/documents/${doc.id}/translations`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        targetLocale: locale,
                        title,
                        content,
                        visibility,
                        apiVersionId: doc.apiVersionId,
                        sourceLocale: doc.locale ?? 'en',
                      }),
                    })

                    const data = await response.json().catch(() => null) as
                      | { documentId?: string; error?: string }
                      | null

                    if (!response.ok || !data?.documentId) {
                      throw new Error(
                        data && 'error' in data && typeof data.error === 'string'
                          ? data.error
                          : 'Could not create the translation document.',
                      )
                    }

                    router.push(getDocEditorHref(data.documentId))
                  } catch (error) {
                    toast.error('Translation creation failed', {
                      description:
                        error instanceof Error
                          ? error.message
                          : 'Could not create the translation document.',
                    })
                  } finally {
                    setPendingLocale(null)
                  }
                }}
              />
              <PresenceAvatars documentId={doc.id} currentUserId={doc.createdBy ?? ''} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Toggle comment sidebar"
                onClick={() => setCommentSidebarOpen((v) => !v)}
              >
                <MessageSquare className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!isEditorFullscreen && isReadOnly ? (
        <div className="border-b border-amber-500/20 bg-amber-50/50 px-4 py-1.5 dark:bg-amber-950/20 sm:px-6">
          <div className={getEditorShellClassName(documentResizeActive)} style={editorShellStyle}>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {isStatusReadOnly
                ? `This document is ${doc.status}. Revert to draft to make changes.`
                : 'You currently have view-only access to this document. Ask a document manager for edit permission.'}
            </p>
          </div>
        </div>
      ) : null}

      <div ref={editorOverlayRef} className="relative flex flex-1 min-h-0">
        <div
          className={cn(
            'flex flex-1',
            isEditorFullscreen ? 'overflow-hidden' : 'overflow-y-auto xl:overflow-hidden',
          )}
        >
          <div className="flex-1">
            <div
              className={cn(
                isEditorFullscreen
                  ? 'h-full w-full px-0 py-0 sm:px-0'
                  : getEditorShellClassName(documentResizeActive),
                !isEditorFullscreen && 'py-4 xl:h-full',
              )}
              style={editorShellStyle}
            >
              <EditorErrorBoundary>
                <DocEditor
                  key={doc.id}
                  content={content}
                  onChange={handleContentChange}
                  readOnly={isReadOnly}
                  readOnlyAiActions={readOnlyAiActions}
                  className={cn(
                    'min-h-[60vh]',
                    isEditorFullscreen ? 'h-full' : 'xl:h-full',
                  )}
                  onModeChange={setEditorMode}
                  editorFocusRef={editorFocusRef}
                  statsOverlayContainerRef={editorOverlayRef}
                  commentsEnabled={!isEditorFullscreen}
                  documentWidth={isEditorFullscreen ? undefined : documentWidth}
                  onDocumentWidthChange={
                    isEditorFullscreen ? undefined : setDocumentWidth
                  }
                  onDocumentResizeStateChange={setDocumentResizeActive}
                  fullscreen={isEditorFullscreen}
                  onFullscreenChange={setIsEditorFullscreen}
                  aiPreviewSide={aiPanelSide}
                  onAiPreviewSideChange={setAiPanelSide}
                  onComment={handleComment}
                />
              </EditorErrorBoundary>
            </div>
          </div>
        </div>
        {!isEditorFullscreen && commentSidebarOpen ? (
          <DocCommentSidebar
            documentId={doc.id}
            className="w-80 shrink-0 border-l"
            pendingComment={pendingComment}
            onCommentCreated={handleCommentCreated}
            onPendingClear={() => setPendingComment(null)}
          />
        ) : null}
      </div>

      {!isEditorFullscreen && doc.status === 'published' ? (
        <DocFeedback documentId={doc.id} className="border-t border-border/60" />
      ) : null}

      {!isEditorFullscreen ? (
        <DocStatusBar
          doc={{ ...doc, title, content }}
          backBusy={backBusy}
          saveState={saveState}
          onBack={() => {
            void handleBack()
          }}
          onTransition={handleTransition}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onRestoreVersion={
            isReadOnly
              ? undefined
              : (versionContent) => {
                  setContent(versionContent)
                  scheduleAutoSave(title, versionContent)
                }
          }
        />
      ) : null}
    </div>
  )
}
