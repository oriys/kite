'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

import { REVIEW_READ_ONLY_AI_ACTIONS } from '@/lib/ai'
import {
  isDocumentTitleMissing,
  type Doc,
  type DocStatus,
  STATUS_CONFIG,
} from '@/lib/documents'
import {
  clearPendingDocumentSummary,
  queuePendingDocumentSummary,
} from '@/lib/document-summary-queue'
import { cn } from '@/lib/utils'
import { BookOpenText, MessageSquare } from 'lucide-react'
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
import { DocReferenceSidebar } from '@/components/docs/doc-reference-sidebar'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { VisibilitySelector } from '@/components/visibility-selector'
import { VisibilityBadge } from '@/components/visibility-badge'
import { ApprovalBanner } from '@/components/approval-banner'
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

interface EditorSnapshot {
  title: string
  content: string
  locale: string
  translationId: string | null
}

export function DocEditorPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id ?? ''
  const docId = searchParams.get('doc')
  const translationParam = searchParams.get('translation')
  const { doc, loading, update, transition, remove, duplicate, refresh } = useDocument(docId)
  const [availableLocales, setAvailableLocales] = React.useState<
    { code: string; translationId?: string }[]
  >([])
  const [pendingLocale, setPendingLocale] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [activeLocale, setActiveLocale] = React.useState('en')
  const [activeTranslationId, setActiveTranslationId] = React.useState<string | null>(
    null,
  )
  const [, setEditorMode] = React.useState<EditorViewMode>('wysiwyg')
  const [documentResizeActive, setDocumentResizeActive] = React.useState(false)
  const [initializedDocId, setInitializedDocId] = React.useState<string | null>(null)
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [commentSidebarOpen, setCommentSidebarOpen] = React.useState(false)
  const [referencePanelOpen, setReferencePanelOpen] = React.useState(false)
  const [isEditorFullscreen, setIsEditorFullscreen] = React.useState(false)
  const [pendingComment, setPendingComment] = React.useState<CommentSelection | null>(null)
  const [referenceDocId, setReferenceDocId] = React.useState<string | null>(null)
  const [visibility, setVisibility] = React.useState<'public' | 'partner' | 'private'>(
    doc?.visibility ?? 'private',
  )
  const [backBusy, setBackBusy] = React.useState(false)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFeedbackRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = React.useRef(0)
  const pendingSaveRef = React.useRef<EditorSnapshot | null>(null)
  const savedSnapshotRef = React.useRef<EditorSnapshot | null>(null)
  const [, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const editorFocusRef = React.useRef<DocEditorHandle | null>(null)
  const editorOverlayRef = React.useRef<HTMLDivElement | null>(null)
  const localeSwitchingRef = React.useRef(false)
  const localeSwitchRequestRef = React.useRef<{
    locale: string
    translationId: string | null
    targetLabel: string
    previousSelection: { locale: string; translationId: string | null }
    created: boolean
    createdWithOriginalContent: boolean
  } | null>(null)
  const { documentWidth, setDocumentWidth } = useDocEditorWidth()
  const { aiPanelSide, setAiPanelSide } = useDocEditorAiPanelSide()
  const sourceLocale = doc?.locale ?? 'en'

  const replaceEditorQuery = React.useCallback(
    (translationId: string | null) => {
      if (!docId) return

      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set('doc', docId)

      if (translationId) {
        nextParams.set('translation', translationId)
      } else {
        nextParams.delete('translation')
      }

      router.replace(`/docs/editor?${nextParams.toString()}`, { scroll: false })
    },
    [docId, router, searchParams],
  )

  const buildSnapshot = React.useCallback(
    (overrides: Partial<EditorSnapshot> = {}): EditorSnapshot => ({
      title: overrides.title ?? title,
      content: overrides.content ?? content,
      locale: overrides.locale ?? activeLocale,
      translationId:
        overrides.translationId === undefined
          ? activeTranslationId
          : overrides.translationId,
    }),
    [activeLocale, activeTranslationId, content, title],
  )

  const applySnapshot = React.useCallback(
    (snapshot: EditorSnapshot) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      setTitle(snapshot.title)
      setContent(snapshot.content)
      setActiveLocale(snapshot.locale)
      setActiveTranslationId(snapshot.translationId)
      savedSnapshotRef.current = snapshot
      pendingSaveRef.current = null
      setSaveState('idle')
    },
    [],
  )

  const clearLocaleTransientState = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (savedFeedbackRef.current) {
      clearTimeout(savedFeedbackRef.current)
      savedFeedbackRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    retryCountRef.current = 0
    pendingSaveRef.current = null
    savedSnapshotRef.current = null
    setSaveState('idle')
  }, [])

  const loadSourceSnapshotFromDatabase = React.useCallback(async (): Promise<EditorSnapshot> => {
    if (!docId) {
      throw new Error('Document is missing.')
    }

    const response = await fetch(`/api/documents/${docId}`)
    if (!response.ok) {
      throw new Error('Failed to load the source language.')
    }

    const data = (await response.json()) as Doc
    setVisibility(data.visibility)

    return {
      title: data.title,
      content: data.content,
      locale: data.locale ?? sourceLocale,
      translationId: null,
    }
  }, [docId, sourceLocale])

  const loadTranslationSnapshotFromDatabase = React.useCallback(
    async (translationId: string, fallbackLocale: string): Promise<EditorSnapshot> => {
      const response = await fetch(`/api/translations/${translationId}`)
      if (!response.ok) {
        throw new Error('Failed to load translation')
      }

      const data = (await response.json()) as {
        locale?: string | null
        latestVersion?: { title?: string; content?: string } | null
      }

      return {
        title: data.latestVersion?.title ?? '',
        content: data.latestVersion?.content ?? '',
        locale: data.locale?.trim() || fallbackLocale,
        translationId,
      }
    },
    [],
  )

  const loadLocaleSnapshotFromDatabase = React.useCallback(
    async ({
      locale,
      translationId,
    }: {
      locale: string
      translationId: string | null
    }): Promise<EditorSnapshot> => {
      if (!translationId) {
        return loadSourceSnapshotFromDatabase()
      }

      return loadTranslationSnapshotFromDatabase(translationId, locale)
    },
    [loadSourceSnapshotFromDatabase, loadTranslationSnapshotFromDatabase],
  )

  const isSnapshotDirty = React.useCallback((snapshot: EditorSnapshot) => {
    const savedSnapshot = savedSnapshotRef.current
    return (
      !savedSnapshot
      || savedSnapshot.locale !== snapshot.locale
      || savedSnapshot.translationId !== snapshot.translationId
      || savedSnapshot.title !== snapshot.title
      || savedSnapshot.content !== snapshot.content
    )
  }, [])

  React.useEffect(() => {
    if (doc && initializedDocId !== doc.id) {
      applySnapshot({
        title: doc.title,
        content: doc.content,
        locale: doc.locale ?? 'en',
        translationId: null,
      })
      setVisibility(doc.visibility)
      setInitializedDocId(doc.id)
    }
  }, [applySnapshot, doc, initializedDocId])

  React.useEffect(() => {
    if (!docId) {
      setInitializedDocId(null)
      setTitle('')
      setContent('')
      setActiveLocale('en')
      setActiveTranslationId(null)
      setAvailableLocales([])
      setPendingLocale(null)
      setCommentSidebarOpen(false)
      setReferencePanelOpen(false)
      setReferenceDocId(null)
      pendingSaveRef.current = null
      savedSnapshotRef.current = null
      return
    }
    if (docId !== initializedDocId) {
      setInitializedDocId(null)
    }
  }, [docId, initializedDocId])

  React.useEffect(() => {
    if (!referenceDocId || referenceDocId !== docId) {
      return
    }

    setReferenceDocId(null)
  }, [docId, referenceDocId])

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
          translations: { id: string; locale: string; status: string }[]
        }

        if (cancelled) return

        const locales = [
          { code: data.currentLocale },
          ...data.translations.map((translation) => ({
            code: translation.locale,
            translationId: translation.id,
          })),
        ]

        setAvailableLocales(
          Array.from(
            new Map(locales.map((locale) => [locale.code, locale])).values(),
          ),
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

  React.useEffect(() => {
    if (!doc) return
    if (!translationParam && activeTranslationId === null) {
      return
    }
    if (translationParam && translationParam === activeTranslationId) {
      return
    }

    let cancelled = false

    async function syncLocaleFromQuery() {
      const switchRequest = localeSwitchRequestRef.current

      try {
        clearLocaleTransientState()
        const snapshot = await loadLocaleSnapshotFromDatabase({
          locale: switchRequest?.locale ?? activeLocale,
          translationId: translationParam,
        })
        if (cancelled) return
        applySnapshot(snapshot)

        if (
          switchRequest
          && switchRequest.translationId === snapshot.translationId
          && switchRequest.locale === snapshot.locale
        ) {
          if (switchRequest.created && snapshot.translationId) {
            if (switchRequest.createdWithOriginalContent) {
              toast.info('Translation created', {
                description:
                  'AI translation was unavailable — the original content was saved.',
              })
            } else {
              toast.success(`${switchRequest.targetLabel} translation created`)
            }
          } else {
            toast.info(`Loaded ${switchRequest.targetLabel}`)
          }
          localeSwitchRequestRef.current = null
        }
      } catch (error) {
        if (cancelled) return

        toast.error('Failed to load selected language', {
          description:
            error instanceof Error ? error.message : 'Could not load the selected language.',
        })

        if (switchRequest) {
          localeSwitchRequestRef.current = null
          replaceEditorQuery(switchRequest.previousSelection.translationId)
        } else if (translationParam) {
          replaceEditorQuery(activeTranslationId)
        }
      } finally {
        if (switchRequest) {
          localeSwitchingRef.current = false
          setPendingLocale(null)
        }
      }
    }

    void syncLocaleFromQuery()

    return () => {
      cancelled = true
    }
  }, [
    activeLocale,
    activeTranslationId,
    applySnapshot,
    clearLocaleTransientState,
    doc,
    loadLocaleSnapshotFromDatabase,
    replaceEditorQuery,
    translationParam,
  ])

  // ── Auto-save with retry ──────────────────────────────────────────────────

  const performSave = React.useCallback(
    async (snapshot: EditorSnapshot): Promise<Doc | true | false> => {
      if (!navigator.onLine) {
        pendingSaveRef.current = snapshot
        setSaveState('offline')
        return false
      }

      setSaveState('saving')
      try {
        let updatedDocument: Doc | undefined

        if (snapshot.translationId) {
          const response = await fetch(`/api/translations/${snapshot.translationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: snapshot.title,
              content: snapshot.content,
            }),
          })

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null

            throw new Error(payload?.error ?? 'Failed to save translation.')
          }
        } else {
          updatedDocument = await update({
            title: snapshot.title,
            content: snapshot.content,
          })
          if (!updatedDocument) {
            throw new Error('You no longer have permission to edit this document.')
          }
        }

        const persistedSnapshot = updatedDocument
          ? {
              title: updatedDocument.title,
              content: updatedDocument.content,
              locale: updatedDocument.locale ?? snapshot.locale,
              translationId: null,
            }
          : snapshot

        pendingSaveRef.current = null
        savedSnapshotRef.current = persistedSnapshot
        retryCountRef.current = 0
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
        setSaveState('saved')
        savedFeedbackRef.current = setTimeout(() => setSaveState('idle'), 2000)
        return updatedDocument ?? true
      } catch {
        pendingSaveRef.current = snapshot
        retryCountRef.current += 1
        setSaveState('error')

        // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30_000)
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
        retryTimerRef.current = setTimeout(() => {
          if (pendingSaveRef.current) {
            void performSave(pendingSaveRef.current)
          }
        }, delay)
        return false
      }
    },
    [update],
  )

  // ── Online/offline detection ────────────────────────────────────────────

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (pendingSaveRef.current) {
        retryCountRef.current = 0
        void performSave(pendingSaveRef.current)
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
  }, [performSave])

  const flushPendingSave = React.useCallback(
    async (overrides?: Partial<EditorSnapshot>) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }

      const snapshot = pendingSaveRef.current
        ? {
            ...pendingSaveRef.current,
            ...overrides,
          }
        : buildSnapshot(overrides)

      pendingSaveRef.current = snapshot

      if (!isSnapshotDirty(snapshot)) {
        pendingSaveRef.current = null
        return true as const
      }

      return performSave(snapshot)
    },
    [buildSnapshot, isSnapshotDirty, performSave],
  )

  const scheduleAutoSave = React.useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current)
      pendingSaveRef.current = buildSnapshot({
        title: newTitle,
        content: newContent,
      })
      setSaveState('saving')
      saveTimerRef.current = setTimeout(() => {
        if (pendingSaveRef.current) {
          void performSave(pendingSaveRef.current)
        }
      }, 800)
    },
    [buildSnapshot, performSave],
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

  const syncLatestEditorContent = React.useCallback(() => {
    const latestContent = editorFocusRef.current?.flushPendingContent?.()
    if (typeof latestContent !== 'string') {
      return content
    }

    if (latestContent !== content) {
      setContent(latestContent)
      pendingSaveRef.current = buildSnapshot({ content: latestContent })
    }

    return latestContent
  }, [buildSnapshot, content])

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      editorFocusRef.current?.focus()
    }
  }

  const handleTransition = async (status: DocStatus) => {
    const latestContent = syncLatestEditorContent()
    const flushed = await flushPendingSave(
      latestContent === content ? undefined : { content: latestContent },
    )
    if (!flushed) {
      toast.error('Failed to save document before changing status')
      return
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
    let shouldNavigate = false

    try {
      const latestContent = syncLatestEditorContent()
      let latestDoc = doc
      const isEditingSourceDocument = activeTranslationId === null
      const titleChanged = Boolean(doc && isEditingSourceDocument && doc.title !== title)
      const contentChanged = Boolean(
        doc && isEditingSourceDocument && doc.content !== latestContent,
      )

      const flushed = await flushPendingSave(
        latestContent === content ? undefined : { content: latestContent },
      )
      if (!flushed) {
        throw new Error('Latest changes could not be saved before leaving the editor.')
      }
      if (flushed !== true) {
        latestDoc = flushed
      }

      const shouldRefreshSummary =
        isEditingSourceDocument &&
        Boolean(latestDoc?.content.trim()) &&
        (
          titleChanged ||
          contentChanged ||
          !latestDoc?.summary ||
          isDocumentTitleMissing(latestDoc?.title)
        )

      if (shouldRefreshSummary) {
        triggerDocumentSummaryRefresh(docId)
      }
      shouldNavigate = true
    } catch (error) {
      toast.error('Could not leave the editor', {
        description:
          error instanceof Error ? error.message : 'The list will fall back to the raw excerpt.',
      })
    } finally {
      setBackBusy(false)
      if (shouldNavigate) {
        router.push('/docs')
      }
    }
  }, [
    activeTranslationId,
    backBusy,
    content,
    doc,
    docId,
    flushPendingSave,
    title,
    syncLatestEditorContent,
    triggerDocumentSummaryRefresh,
    router,
  ])

  const handleLocaleChange = React.useCallback(
    async (locale: string, translationId: string | undefined, targetLabel: string) => {
      if (!doc) return
      if (locale === activeLocale) return
      if (localeSwitchingRef.current) return

      const previousSelection = {
        locale: activeLocale,
        translationId: activeTranslationId,
      }

      localeSwitchingRef.current = true
      setPendingLocale(locale)
      let handedOffToQueryLoader = false
      try {
        const latestContent = syncLatestEditorContent()
        const flushed = await flushPendingSave(
          latestContent === content ? undefined : { content: latestContent },
        )
        if (!flushed) {
          throw new Error('Save the current draft before switching languages.')
        }

        let nextTranslationId = locale === sourceLocale ? null : (translationId ?? null)
        let createdWithOriginalContent = false
        let created = false

        if (!nextTranslationId) {
          if (locale !== sourceLocale) {
            const translateText = async (text: string) => {
              if (!text.trim()) return text
              const res = await fetch('/api/ai/transform', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'translate',
                  text,
                  targetLanguage: targetLabel,
                }),
              })
              if (!res.ok) return null
              const data = (await res.json().catch(() => null)) as
                | { result?: string }
                | null
              return data?.result ?? null
            }

            const [translatedTitle, translatedContent] = await Promise.all([
              translateText(title),
              translateText(latestContent),
            ])

            const response = await fetch(`/api/documents/${doc.id}/translations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetLocale: locale,
                title: translatedTitle ?? title,
                content: translatedContent ?? latestContent,
              }),
            })

            const data = (await response.json().catch(() => null)) as
              | { translationId?: string; error?: string }
              | null

            if (!response.ok || !data?.translationId) {
              throw new Error(
                data && 'error' in data && typeof data.error === 'string'
                  ? data.error
                  : 'Could not create the translation.',
              )
            }

            nextTranslationId = data.translationId
            created = true
            createdWithOriginalContent = translatedContent === null

            setAvailableLocales((prev) => {
              const next = prev.filter((item) => item.code !== locale)
              return [...next, { code: locale, translationId: data.translationId }]
            })
          }
        }

        localeSwitchRequestRef.current = {
          locale,
          translationId: nextTranslationId,
          targetLabel,
          previousSelection,
          created,
          createdWithOriginalContent,
        }
        replaceEditorQuery(nextTranslationId)
        handedOffToQueryLoader = true
      } catch (error) {
        localeSwitchRequestRef.current = null
        toast.error('Translation failed', {
          description:
            error instanceof Error
              ? error.message
              : 'Could not create the translation.',
        })
      } finally {
        if (!handedOffToQueryLoader) {
          localeSwitchingRef.current = false
          setPendingLocale(null)
        }
      }
    },
    [
      activeLocale,
      activeTranslationId,
      content,
      doc,
      flushPendingSave,
      replaceEditorQuery,
      sourceLocale,
      syncLatestEditorContent,
      title,
    ],
  )

  if (loading) {
    return <EditorSkeleton />
  }

  if (!docId || !doc) {
    return <MissingDocumentState />
  }

  const isPermissionReadOnly = !doc.canEdit
  const isStatusReadOnly = doc.status !== 'draft'
  const isReadOnly = isStatusReadOnly || isPermissionReadOnly
  const readOnlyBannerTone = isStatusReadOnly
    ? doc.status === 'published'
      ? {
          wrapper: 'border-tone-info-border bg-tone-info-bg',
          text: 'text-tone-info-text',
        }
      : {
          wrapper: 'border-tone-caution-border bg-tone-caution-bg',
          text: 'text-tone-caution-text',
        }
    : {
        wrapper: 'border-tone-info-border bg-tone-info-bg',
        text: 'text-tone-info-text',
      }
  const readOnlyAiActions = doc.status === 'review' ? REVIEW_READ_ONLY_AI_ACTIONS : undefined
  const editorShellStyle = isEditorFullscreen
    ? undefined
    : getEditorShellStyle(documentWidth)
  const showCommentSidebar = !isEditorFullscreen && commentSidebarOpen
  const showReferencePanel = !isEditorFullscreen && referencePanelOpen
  const editorWorkspace = (
    <div
      className={cn(
        'flex h-full w-full min-h-0 min-w-0',
        isEditorFullscreen ? 'overflow-hidden' : 'overflow-y-auto xl:overflow-hidden',
      )}
    >
      <div className="flex flex-1 min-h-0 min-w-0">
        <div
          ref={editorOverlayRef}
          className="relative flex min-h-0 flex-1 min-w-0 flex-col"
        >
          <div className="flex-1 min-h-0 min-w-0">
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
                  key={activeTranslationId ? `${doc.id}:${activeTranslationId}` : `${doc.id}:source`}
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
        {showCommentSidebar ? (
          <DocCommentSidebar
            documentId={doc.id}
            className="w-80 shrink-0 border-l"
            pendingComment={pendingComment}
            onCommentCreated={handleCommentCreated}
            onPendingClear={() => setPendingComment(null)}
          />
        ) : null}
      </div>
    </div>
  )

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
                currentLocale={activeLocale}
                availableLocales={availableLocales}
                pendingLocale={pendingLocale}
                onLocaleChange={handleLocaleChange}
              />
              <PresenceAvatars documentId={doc.id} currentUserId={currentUserId} />
              <Button
                variant={referencePanelOpen ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Toggle reference document panel"
                aria-pressed={referencePanelOpen}
                onClick={() => setReferencePanelOpen((current) => !current)}
              >
                <BookOpenText className="size-4" />
              </Button>
              <Button
                variant={commentSidebarOpen ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Toggle comment sidebar"
                aria-pressed={commentSidebarOpen}
                onClick={() => setCommentSidebarOpen((current) => !current)}
              >
                <MessageSquare className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!isEditorFullscreen && isReadOnly ? (
        <div className={cn('border-b px-4 py-1.5 sm:px-6', readOnlyBannerTone.wrapper)}>
          <div className={getEditorShellClassName(documentResizeActive)} style={editorShellStyle}>
            <p className={cn('text-xs', readOnlyBannerTone.text)}>
              {isStatusReadOnly
                ? `This document is ${doc.status}. Revert to draft to make changes.`
                : 'You currently have view-only access to this document. Ask a document manager for edit permission.'}
            </p>
          </div>
        </div>
      ) : null}

      {!isEditorFullscreen && doc.status === 'review' ? (
        <div className="border-b border-border/60 px-4 py-3 sm:px-6">
          <div className={getEditorShellClassName(documentResizeActive)} style={editorShellStyle}>
            <ApprovalBanner
              documentId={doc.id}
              currentUserId={currentUserId}
              onStatusChange={() => void refresh()}
            />
          </div>
        </div>
      ) : null}

      <div className="relative flex flex-1 min-h-0">
        {showReferencePanel ? (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={60} minSize={35} className="min-h-0">
              {editorWorkspace}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={24} className="min-h-0">
              <DocReferenceSidebar
                activeDocumentId={doc.id}
                referenceDocumentId={referenceDocId}
                className="h-full border-l border-border/50"
                onReferenceDocumentChange={setReferenceDocId}
                onClose={() => setReferencePanelOpen(false)}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          editorWorkspace
        )}
      </div>

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
            isReadOnly || activeTranslationId !== null
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
