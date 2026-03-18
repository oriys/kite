'use client'

import * as React from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

import { REVIEW_READ_ONLY_AI_ACTIONS } from '@/lib/ai'
import {
  areDocumentTagsEqual,
  getDocEditorHref,
  getDocumentIdentifier,
  isDocumentTitleMissing,
  normalizeDocumentTags,
  normalizeDocumentSlug,
  type Doc,
  type DocStatus,
  STATUS_CONFIG,
} from '@/lib/documents'
import {
  clearPendingDocumentSummary,
  queuePendingDocumentSummary,
} from '@/lib/document-summary-queue'
import { cn } from '@/lib/utils'
import { BookOpenText, ChevronDown, Download, Globe, Link2, List, Lock, MessageSquare, MoreHorizontal, ShieldCheck, Tag, Users } from 'lucide-react'
import type { CommentSelection } from '@/lib/editor/editor-helpers'
import { clampDocEditorWidth } from '@/lib/doc-editor-layout'
import { useDocEditorAiPanelSide } from '@/hooks/use-doc-editor-ai-panel-side'
import { useDocument } from '@/hooks/use-documents'
import { useDocEditorWidth } from '@/hooks/use-doc-editor-width'
import { DocsForbiddenState } from '@/components/docs/docs-forbidden-state'
import { Badge } from '@/components/ui/badge'
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
import { DocOutline } from '@/components/docs/doc-outline'
import { type OutlineHeading } from '@/hooks/use-doc-outline'
import { DocReferenceSidebar } from '@/components/docs/doc-reference-sidebar'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ApprovalBanner } from '@/components/approval-banner'
import { PresenceAvatars } from '@/components/presence-avatars'
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

function formatDocumentTags(value: readonly string[]) {
  return value.join(', ')
}

const LOCALE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
] as const

const VISIBILITY_OPTIONS = [
  { value: 'public' as const, label: 'Public', Icon: Globe, iconClass: 'text-tone-success-text' },
  { value: 'partner' as const, label: 'Partner', Icon: Users, iconClass: 'text-tone-caution-text' },
  { value: 'private' as const, label: 'Private', Icon: Lock, iconClass: 'text-tone-error-text' },
]

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
  const params = useParams<{ doc?: string }>()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id ?? ''
  const routeDocParam = Array.isArray(params.doc) ? params.doc[0] : params.doc ?? null
  const docId = routeDocParam ?? searchParams.get('doc')
  const translationParam = searchParams.get('translation')
  const referenceParam = searchParams.get('reference')
  const { doc, loading, errorStatus, update, transition, remove, duplicate, refresh } = useDocument(docId)
  const [availableLocales, setAvailableLocales] = React.useState<
    { code: string; translationId?: string }[]
  >([])
  const [pendingLocale, setPendingLocale] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [tagsInput, setTagsInput] = React.useState('')
  const [slugInput, setSlugInput] = React.useState('')
  const [activeLocale, setActiveLocale] = React.useState('en')
  const [activeTranslationId, setActiveTranslationId] = React.useState<string | null>(
    null,
  )
  const [, setEditorMode] = React.useState<EditorViewMode>('wysiwyg')
  const [documentResizeActive, setDocumentResizeActive] = React.useState(false)
  const [initializedDocId, setInitializedDocId] = React.useState<string | null>(null)
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [commentSidebarOpen, setCommentSidebarOpen] = React.useState(false)
  const [outlineOpen, setOutlineOpen] = React.useState(false)
  const [outlineHeadings, setOutlineHeadings] = React.useState<OutlineHeading[]>([])
  const [outlineActiveId, setOutlineActiveId] = React.useState<string | null>(null)
  const [referencePanelOpen, setReferencePanelOpen] = React.useState(false)
  const [isEditorFullscreen, setIsEditorFullscreen] = React.useState(false)
  const [metadataExpanded, setMetadataExpanded] = React.useState(false)
  const [permissionsDialogOpen, setPermissionsDialogOpen] = React.useState(false)
  const [pendingComment, setPendingComment] = React.useState<CommentSelection | null>(null)
  const [referenceDocIdentifier, setReferenceDocIdentifier] = React.useState<string | null>(null)
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

  // Poll outline headings from the editor handle when the sidebar is open
  React.useEffect(() => {
    if (!outlineOpen) return
    const tick = () => {
      const handle = editorFocusRef.current
      if (handle) {
        setOutlineHeadings(handle.getOutlineHeadings?.() ?? [])
        setOutlineActiveId(handle.getOutlineActiveId?.() ?? null)
      }
    }
    tick()
    const id = setInterval(tick, 600)
    return () => clearInterval(id)
  }, [outlineOpen])
  const sourceLocale = doc?.locale ?? 'en'
  const editorSignInHref = React.useMemo(() => {
    const query = searchParams.toString()
    const callbackPath = `${pathname}${query ? `?${query}` : ''}`

    return `/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`
  }, [pathname, searchParams])

  const replaceEditorLocation = React.useCallback(
    (overrides: {
      docIdentifier?: string | null
      translationId?: string | null
      referenceIdentifier?: string | null
    }) => {
      const nextDocIdentifier =
        overrides.docIdentifier === undefined ? docId : overrides.docIdentifier

      if (!nextDocIdentifier) return

      const nextTranslationId =
        overrides.translationId === undefined
          ? translationParam
          : overrides.translationId
      const nextReferenceIdentifier =
        overrides.referenceIdentifier === undefined
          ? referenceParam
          : overrides.referenceIdentifier

      router.replace(
        getDocEditorHref(nextDocIdentifier, {
          translation: nextTranslationId,
          reference: nextReferenceIdentifier,
        }),
        { scroll: false },
      )
    },
    [docId, referenceParam, router, translationParam],
  )

  const handleReferenceDocumentChange = React.useCallback(
    (nextReferenceIdentifier: string | null) => {
      setReferencePanelOpen(true)
      setReferenceDocIdentifier(nextReferenceIdentifier)
      replaceEditorLocation({ referenceIdentifier: nextReferenceIdentifier })
    },
    [replaceEditorLocation],
  )

  const handleReferencePanelClose = React.useCallback(() => {
    setReferencePanelOpen(false)
    setReferenceDocIdentifier(null)
    replaceEditorLocation({ referenceIdentifier: null })
  }, [replaceEditorLocation])

  const handleReferencePanelToggle = React.useCallback(() => {
    if (referencePanelOpen) {
      handleReferencePanelClose()
      return
    }

    setReferencePanelOpen(true)
  }, [handleReferencePanelClose, referencePanelOpen])

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

  const clearPendingAutosave = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    pendingSaveRef.current = null
    retryCountRef.current = 0
    setSaveState((current) =>
      current === 'saving' || current === 'error' || current === 'offline'
        ? 'idle'
        : current,
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
      setCategory(doc.category ?? '')
      setTagsInput(formatDocumentTags(doc.tags ?? []))
      setSlugInput(doc.slug ?? '')
      setVisibility(doc.visibility)
      setInitializedDocId(doc.id)
    }
  }, [applySnapshot, doc, initializedDocId])

  React.useEffect(() => {
    if (!docId) {
      setInitializedDocId(null)
      setTitle('')
      setContent('')
      setCategory('')
      setTagsInput('')
      setSlugInput('')
      setActiveLocale('en')
      setActiveTranslationId(null)
      setAvailableLocales([])
      setPendingLocale(null)
      setCommentSidebarOpen(false)
      setReferencePanelOpen(false)
      setReferenceDocIdentifier(null)
      pendingSaveRef.current = null
      savedSnapshotRef.current = null
      return
    }
    if (docId !== initializedDocId) {
      setInitializedDocId(null)
    }
  }, [docId, initializedDocId])

  React.useEffect(() => {
    if (errorStatus === 401) {
      router.replace(editorSignInHref)
    }
  }, [editorSignInHref, errorStatus, router])

  React.useEffect(() => {
    if (!referenceParam) {
      setReferenceDocIdentifier(null)
      return
    }

    if (referenceParam === docId) {
      setReferenceDocIdentifier(null)
      return
    }

    setReferencePanelOpen(true)
    setReferenceDocIdentifier(referenceParam)
  }, [docId, referenceParam])

  React.useEffect(() => {
    if (!docId || !doc) {
      return
    }

    const preferredDocIdentifier = getDocumentIdentifier(doc)
    if (docId === preferredDocIdentifier) {
      return
    }

    replaceEditorLocation({ docIdentifier: preferredDocIdentifier })
  }, [doc, docId, replaceEditorLocation])

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
          replaceEditorLocation({
            translationId: switchRequest.previousSelection.translationId,
          })
        } else if (translationParam) {
          replaceEditorLocation({ translationId: activeTranslationId })
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
    replaceEditorLocation,
    translationParam,
  ])

  // ── Auto-save with retry ──────────────────────────────────────────────────

  const performSave = React.useCallback(
    async (snapshot: EditorSnapshot): Promise<Doc | true | false> => {
      if (!isSnapshotDirty(snapshot)) {
        clearPendingAutosave()
        return true
      }

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
    [clearPendingAutosave, isSnapshotDirty, update],
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
        clearPendingAutosave()
        return true as const
      }

      return performSave(snapshot)
    },
    [buildSnapshot, clearPendingAutosave, isSnapshotDirty, performSave],
  )

  const scheduleAutoSave = React.useCallback(
    (newTitle: string, newContent: string) => {
      const snapshot = buildSnapshot({
        title: newTitle,
        content: newContent,
      })

      if (!isSnapshotDirty(snapshot)) {
        clearPendingAutosave()
        return
      }

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current)
      pendingSaveRef.current = snapshot
      setSaveState('saving')
      saveTimerRef.current = setTimeout(() => {
        if (pendingSaveRef.current) {
          void performSave(pendingSaveRef.current)
        }
      }, 800)
    },
    [buildSnapshot, clearPendingAutosave, isSnapshotDirty, performSave],
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

  const handleTitleChange = React.useCallback((newTitle: string) => {
    if (newTitle === title) {
      return
    }

    setTitle(newTitle)
    scheduleAutoSave(newTitle, content)
  }, [content, scheduleAutoSave, title])

  const handleContentChange = React.useCallback((newContent: string) => {
    if (newContent === content) {
      return
    }

    setContent(newContent)
    scheduleAutoSave(title, newContent)
  }, [content, scheduleAutoSave, title])

  const handleCategorySave = React.useCallback(
    async (nextCategory: string) => {
      if (!docId) return

      const normalizedCategory = nextCategory.trim()
      if (normalizedCategory === (doc?.category ?? '').trim()) {
        setCategory(normalizedCategory)
        return
      }

      setCategory(normalizedCategory)

      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: normalizedCategory }),
        })
        if (!res.ok) throw new Error('Failed to update category')
        await refresh()
        toast.success(
          normalizedCategory ? `Category set to ${normalizedCategory}` : 'Category cleared',
        )
      } catch {
        setCategory(doc?.category ?? '')
        toast.error('Failed to update category')
      }
    },
    [doc?.category, docId, refresh],
  )

  const handleCategoryKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void handleCategorySave(category)
        editorFocusRef.current?.focus()
      }
    },
    [category, handleCategorySave],
  )

  const handleTagsSave = React.useCallback(
    async (nextTagsValue: string) => {
      if (!docId) return

      const normalizedTags = normalizeDocumentTags(nextTagsValue)
      if (areDocumentTagsEqual(normalizedTags, doc?.tags ?? [])) {
        setTagsInput(formatDocumentTags(normalizedTags))
        return
      }

      setTagsInput(formatDocumentTags(normalizedTags))

      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: normalizedTags }),
        })
        if (!res.ok) throw new Error('Failed to update tags')
        await refresh()
        toast.success(normalizedTags.length > 0 ? 'Tags updated' : 'Tags cleared')
      } catch {
        setTagsInput(formatDocumentTags(doc?.tags ?? []))
        toast.error('Failed to update tags')
      }
    },
    [doc?.tags, docId, refresh],
  )

  const handleTagsKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void handleTagsSave(tagsInput)
        editorFocusRef.current?.focus()
      }
    },
    [handleTagsSave, tagsInput],
  )

  const handleSlugSave = React.useCallback(
    async (nextSlug: string) => {
      if (!doc) return

      const normalizedSlug = nextSlug.trim() ? normalizeDocumentSlug(nextSlug) : ''
      if (normalizedSlug === (doc.slug ?? '')) {
        setSlugInput(doc.slug ?? normalizedSlug)
        return
      }

      setSlugInput(normalizedSlug)

      try {
        const updatedDocument = await update({ slug: normalizedSlug })
        if (!updatedDocument) {
          throw new Error('Failed to update URL')
        }

        setSlugInput(updatedDocument.slug ?? '')
        replaceEditorLocation({
          docIdentifier: getDocumentIdentifier(updatedDocument),
        })
        toast.success('Document URL updated')
      } catch {
        setSlugInput(doc.slug ?? '')
        toast.error('Failed to update document URL')
      }
    },
    [doc, replaceEditorLocation, update],
  )

  const handleSlugKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void handleSlugSave(slugInput)
        editorFocusRef.current?.focus()
      }
    },
    [handleSlugSave, slugInput],
  )

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
      router.push(getDocEditorHref(newDoc))
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
        replaceEditorLocation({ translationId: nextTranslationId })
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
      replaceEditorLocation,
      sourceLocale,
      syncLatestEditorContent,
      title,
    ],
  )

  if (loading) {
    return <EditorSkeleton />
  }

  if (errorStatus === 401) {
    return <EditorSkeleton />
  }

  if (errorStatus === 403) {
    return (
      <DocsForbiddenState
        title="You cannot open this document."
        description="This document is available in the workspace, but your current role or document permissions do not allow access. Ask a document manager or workspace admin if you need entry."
      />
    )
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
  const showOutlineSidebar = !isEditorFullscreen && outlineOpen
  const showReferencePanel = !isEditorFullscreen && referencePanelOpen
  const currentVisibility = VISIBILITY_OPTIONS.find((o) => o.value === visibility) ?? VISIBILITY_OPTIONS[2]
  const currentLocaleLabel = LOCALE_OPTIONS.find((l) => l.code === activeLocale)?.label ?? activeLocale
  const mergedLocales = LOCALE_OPTIONS.map((l) => {
    const available = availableLocales.find((a) => a.code === l.code)
    return {
      ...l,
      available: !!available || l.code === activeLocale,
      translationId: available?.translationId,
    }
  })
  const existingLocales = mergedLocales.filter((l) => l.available)
  const creatableLocales = mergedLocales.filter((l) => !l.available)
  const handleExport = (format: 'markdown' | 'html' | 'pdf' | 'docx', theme?: 'light' | 'dark') => {
    const params = new URLSearchParams({
      documentId: doc.id,
      format,
      ...(theme && { theme }),
    })
    window.open(`/api/export?${params}`, '_blank')
  }
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
                  outlineOpen={outlineOpen}
                  onOutlineOpenChange={setOutlineOpen}
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
        {showOutlineSidebar ? (
          <div className="w-60 shrink-0 border-l overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            <DocOutline
              headings={outlineHeadings}
              activeId={outlineActiveId}
              onSelect={(h) => editorFocusRef.current?.scrollToOutlineHeading?.(h)}
              onClose={() => setOutlineOpen(false)}
            />
          </div>
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
                className="min-w-0 flex-1 border-0 bg-transparent px-0 text-lg font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
              />
              <PresenceAvatars documentId={doc.id} currentUserId={currentUserId} />
              <Button
                variant={outlineOpen ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Toggle document outline"
                aria-pressed={outlineOpen}
                onClick={() => setOutlineOpen((v) => !v)}
              >
                <List className="size-4" />
              </Button>
              <Button
                variant={referencePanelOpen ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Toggle reference document panel"
                aria-pressed={referencePanelOpen}
                onClick={handleReferencePanelToggle}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {isReadOnly || !doc.canManagePermissions ? (
                    <DropdownMenuLabel className="flex items-center gap-2 text-sm font-normal">
                      <currentVisibility.Icon className={cn('size-4', currentVisibility.iconClass)} />
                      {currentVisibility.label}
                    </DropdownMenuLabel>
                  ) : (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <currentVisibility.Icon className={cn('size-4', currentVisibility.iconClass)} />
                        {currentVisibility.label}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={visibility}
                          onValueChange={(v) =>
                            handleVisibilityChange(v as 'public' | 'partner' | 'private')
                          }
                        >
                          {VISIBILITY_OPTIONS.map((opt) => (
                            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {doc.canManagePermissions ? (
                    <DropdownMenuItem onSelect={() => setPermissionsDialogOpen(true)}>
                      <ShieldCheck className="size-4" />
                      Permissions
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Download className="size-4" />
                      Export
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onSelect={() => handleExport('markdown')}>
                        Markdown (.md)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleExport('html', 'light')}>
                        HTML (Light)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleExport('html', 'dark')}>
                        HTML (Dark)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleExport('pdf')}>
                        PDF (.pdf)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleExport('docx')}>
                        Word (.docx)
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Globe className="size-4" />
                      {currentLocaleLabel}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      <DropdownMenuRadioGroup
                        value={activeLocale}
                        onValueChange={(code) => {
                          const locale = existingLocales.find((l) => l.code === code)
                          if (locale && locale.code !== activeLocale) {
                            handleLocaleChange(locale.code, locale.translationId, locale.label)
                          }
                        }}
                      >
                        {existingLocales.map((locale) => (
                          <DropdownMenuRadioItem
                            key={locale.code}
                            value={locale.code}
                            disabled={!!pendingLocale}
                          >
                            {locale.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      {creatableLocales.length > 0 ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Add translation</DropdownMenuLabel>
                          {creatableLocales.map((locale) => (
                            <DropdownMenuItem
                              key={locale.code}
                              disabled={!!pendingLocale}
                              onSelect={() =>
                                handleLocaleChange(locale.code, locale.translationId, locale.label)
                              }
                            >
                              {locale.label}
                            </DropdownMenuItem>
                          ))}
                        </>
                      ) : null}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setMetadataExpanded((v) => !v)}>
                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform',
                        metadataExpanded && 'rotate-180',
                      )}
                    />
                    {metadataExpanded ? 'Hide details' : 'Show details'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DocumentPermissionsDialog
                document={doc}
                open={permissionsDialogOpen}
                onOpenChange={setPermissionsDialogOpen}
                onPermissionsChanged={refresh}
              />
            </div>
            {metadataExpanded ? (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {isReadOnly ? (
                  category ? (
                    <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2.5 text-xs text-muted-foreground">
                      <List className="size-3.5" />
                      <span className="max-w-[160px] truncate">{category}</span>
                    </div>
                  ) : null
                ) : (
                  <div className="flex h-8 w-[170px] items-center gap-1.5 rounded-md border border-input/80 bg-background/80 px-2.5">
                    <List className="size-3.5 text-muted-foreground" />
                    <Input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      onBlur={() => void handleCategorySave(category)}
                      onKeyDown={handleCategoryKeyDown}
                      aria-label="Document category"
                      placeholder="Category"
                      className="h-auto border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                    />
                  </div>
                )}
                {isReadOnly ? (
                  doc.tags.length > 0 ? (
                    <div className="inline-flex min-h-8 max-w-full items-start gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2.5 py-1.5 text-xs text-muted-foreground">
                      <Tag className="mt-0.5 size-3.5 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {doc.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="h-5 rounded-md border-border/60 bg-background/60 px-1.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null
                ) : (
                  <div className="flex min-h-8 min-w-[220px] max-w-full items-center gap-1.5 rounded-md border border-input/80 bg-background/80 px-2.5">
                    <Tag className="size-3.5 text-muted-foreground" />
                    <Input
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      onBlur={() => void handleTagsSave(tagsInput)}
                      onKeyDown={handleTagsKeyDown}
                      aria-label="Document tags"
                      placeholder="Tags, comma separated"
                      className="h-auto border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                    />
                  </div>
                )}
                {isReadOnly ? (
                  <div className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/25 px-2.5 text-xs text-muted-foreground">
                    <Link2 className="size-3.5" />
                    <span className="truncate">/docs/editor/{doc.slug ?? getDocumentIdentifier(doc)}</span>
                  </div>
                ) : (
                  <div className="flex h-8 min-w-[240px] max-w-full items-center gap-1.5 rounded-md border border-input/80 bg-background/80 px-2.5 sm:w-[320px]">
                    <Link2 className="size-3.5 text-muted-foreground" />
                    <span className="shrink-0 text-[11px] text-muted-foreground">/docs/editor/</span>
                    <Input
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value)}
                      onBlur={() => void handleSlugSave(slugInput)}
                      onKeyDown={handleSlugKeyDown}
                      aria-label="Document URL slug"
                      placeholder={normalizeDocumentSlug(title || doc.title)}
                      className="h-auto border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                    />
                  </div>
                )}
              </div>
            ) : null}
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
                referenceDocumentId={referenceDocIdentifier}
                className="h-full border-l border-border/50"
                onReferenceDocumentChange={handleReferenceDocumentChange}
                onClose={handleReferencePanelClose}
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
