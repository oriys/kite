'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutTemplate } from 'lucide-react'
import { toast } from 'sonner'

import { clampDocEditorWidth } from '@/lib/doc-editor-layout'
import { getDocEditorHref } from '@/lib/documents'
import {
  getTemplateEditorHref,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
} from '@/lib/templates'
import { cn } from '@/lib/utils'
import { useDocEditorAiPanelSide } from '@/hooks/use-doc-editor-ai-panel-side'
import { useDocEditorWidth } from '@/hooks/use-doc-editor-width'
import { useTemplate } from '@/hooks/use-templates'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EditorErrorBoundary } from '@/components/docs/editor-error-boundary'
import {
  DocEditor,
  type DocEditorHandle,
} from '@/components/docs/doc-editor'
import {
  TemplateStatusBar,
  type TemplateSaveState,
} from '@/components/templates/template-status-bar'

function getEditorShellClassName(resizing = false) {
  return cn(
    'mx-auto w-full px-4 motion-reduce:transition-none sm:px-6',
    !resizing &&
      'transition-[max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
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
        <div className="mx-auto max-w-5xl space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-9 w-full max-w-xl" />
        </div>
      </div>
      <div className="flex-1 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-[620px] w-full rounded-xl" />
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

function MissingTemplateState() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-lg border border-border/70 bg-card p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Template not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a template from the library or create a new one first.
        </p>
        <button
          type="button"
          onClick={() => router.push('/docs/templates')}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to Templates
        </button>
      </div>
    </div>
  )
}

interface TemplateDraft {
  name: string
  description: string
  category: TemplateCategory
  content: string
}

export function TemplateEditorPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const templateId = searchParams.get('template')
  const { template, loading, update, remove, duplicate, createDocument } =
    useTemplate(templateId)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState<TemplateCategory>('custom')
  const [content, setContent] = React.useState('')
  const [initializedTemplateId, setInitializedTemplateId] = React.useState<
    string | null
  >(null)
  const [saveState, setSaveState] =
    React.useState<TemplateSaveState>('idle')
  const [duplicateBusy, setDuplicateBusy] = React.useState(false)
  const [createDocumentBusy, setCreateDocumentBusy] = React.useState(false)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const editorFocusRef = React.useRef<DocEditorHandle | null>(null)
  const editorOverlayRef = React.useRef<HTMLDivElement | null>(null)
  const pendingSaveRef = React.useRef<TemplateDraft | null>(null)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFeedbackRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = React.useRef(0)
  const { documentWidth, setDocumentWidth } = useDocEditorWidth()
  const { aiPanelSide, setAiPanelSide } = useDocEditorAiPanelSide()
  const [documentResizeActive, setDocumentResizeActive] = React.useState(false)

  React.useEffect(() => {
    if (template && initializedTemplateId !== template.id) {
      setName(template.name)
      setDescription(template.description)
      setCategory(template.category)
      setContent(template.content)
      setInitializedTemplateId(template.id)
      setSaveState('idle')
    }
  }, [initializedTemplateId, template])

  React.useEffect(() => {
    if (!templateId) {
      setInitializedTemplateId(null)
      setName('')
      setDescription('')
      setCategory('custom')
      setContent('')
      return
    }

    if (templateId !== initializedTemplateId) {
      setInitializedTemplateId(null)
    }
  }, [initializedTemplateId, templateId])

  const buildDraft = React.useCallback(
    (
      nextName: string,
      nextDescription: string,
      nextCategory: TemplateCategory,
      nextContent: string,
    ): TemplateDraft => ({
      name: nextName,
      description: nextDescription,
      category: nextCategory,
      content: nextContent,
    }),
    [],
  )

  const performSave = React.useCallback(
    async (draft: TemplateDraft) => {
      if (!navigator.onLine) {
        pendingSaveRef.current = draft
        setSaveState('offline')
        return undefined
      }

      setSaveState('saving')
      try {
        const updated = await update(draft)
        if (!updated) {
          throw new Error('Failed to save template')
        }

        pendingSaveRef.current = null
        retryCountRef.current = 0
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current)
        }
        if (savedFeedbackRef.current) {
          clearTimeout(savedFeedbackRef.current)
        }

        setSaveState('saved')
        savedFeedbackRef.current = setTimeout(() => setSaveState('idle'), 2000)
        return updated
      } catch {
        pendingSaveRef.current = draft
        retryCountRef.current += 1
        setSaveState('error')

        const delay = Math.min(
          2000 * Math.pow(2, retryCountRef.current - 1),
          30_000,
        )

        retryTimerRef.current = setTimeout(() => {
          if (pendingSaveRef.current) {
            void performSave(pendingSaveRef.current)
          }
        }, delay)

        return undefined
      }
    },
    [update],
  )

  const scheduleAutoSave = React.useCallback(
    (draft: TemplateDraft) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current)
      pendingSaveRef.current = draft
      setSaveState('saving')
      saveTimerRef.current = setTimeout(() => {
        void performSave(draft)
      }, 800)
    },
    [performSave],
  )

  const flushPendingSave = React.useCallback(async () => {
    if (!template) return undefined

    const currentDraft = buildDraft(name, description, category, content)
    const hasChanges =
      template.name !== currentDraft.name ||
      template.description !== currentDraft.description ||
      template.category !== currentDraft.category ||
      template.content !== currentDraft.content

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
      return performSave(currentDraft)
    }

    if (hasChanges) {
      return performSave(currentDraft)
    }

    return template
  }, [buildDraft, category, content, description, name, performSave, template])

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

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  const handleNameChange = (nextName: string) => {
    setName(nextName)
    scheduleAutoSave(buildDraft(nextName, description, category, content))
  }

  const handleDescriptionChange = (nextDescription: string) => {
    setDescription(nextDescription)
    scheduleAutoSave(buildDraft(name, nextDescription, category, content))
  }

  const handleCategoryChange = (nextCategory: TemplateCategory) => {
    setCategory(nextCategory)
    scheduleAutoSave(buildDraft(name, description, nextCategory, content))
  }

  const handleContentChange = (nextContent: string) => {
    setContent(nextContent)
    scheduleAutoSave(buildDraft(name, description, category, nextContent))
  }

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      editorFocusRef.current?.focus()
    }
  }

  const handleBack = React.useCallback(async () => {
    await flushPendingSave()
    router.push('/docs/templates')
  }, [flushPendingSave, router])

  const handleDuplicate = React.useCallback(async () => {
    setDuplicateBusy(true)
    try {
      await flushPendingSave()
      const duplicated = await duplicate()
      if (!duplicated) {
        toast.error('Failed to duplicate template')
        return
      }

      toast.success('Template duplicated', {
        description: `Created "${duplicated.name}".`,
      })
      router.push(getTemplateEditorHref(duplicated.id))
    } finally {
      setDuplicateBusy(false)
    }
  }, [duplicate, flushPendingSave, router])

  const handleCreateDocument = React.useCallback(async () => {
    setCreateDocumentBusy(true)
    try {
      await flushPendingSave()
      const doc = await createDocument(name.trim() || undefined)
      if (!doc) {
        toast.error('Failed to create document from template')
        return
      }

      toast.success('Document created', {
        description: `Created "${doc.title}".`,
      })
      router.push(getDocEditorHref(doc.id))
    } finally {
      setCreateDocumentBusy(false)
    }
  }, [createDocument, flushPendingSave, name, router])

  const handleDelete = React.useCallback(async () => {
    setDeleteBusy(true)
    try {
      const deleted = await remove()
      if (!deleted) {
        toast.error('Failed to delete template')
        return
      }

      toast.success('Template deleted')
      router.push('/docs/templates')
    } finally {
      setDeleteBusy(false)
    }
  }, [remove, router])

  if (loading) {
    return <EditorSkeleton />
  }

  if (!templateId || !template) {
    return <MissingTemplateState />
  }

  const editorShellStyle = getEditorShellStyle(documentWidth)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
        <div
          className={getEditorShellClassName(documentResizeActive)}
          style={editorShellStyle}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-6 gap-1.5 px-2 text-[10px]">
                <LayoutTemplate className="size-3" />
                Template
              </Badge>
              {template.isBuiltIn ? (
                <Badge variant="secondary" className="h-6 px-2 text-[10px]">
                  Built-in
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1 space-y-3">
                <Input
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  aria-label="Template name"
                  placeholder="Untitled template…"
                  className="border-0 bg-transparent px-0 text-xl font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                />
                <Input
                  value={description}
                  onChange={(event) =>
                    handleDescriptionChange(event.target.value)
                  }
                  aria-label="Template description"
                  placeholder="Add a short description for where this template should be used…"
                  className="h-9 border-0 bg-transparent px-0 text-sm text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                />
              </div>

              <div className="w-full shrink-0 space-y-2 lg:w-56">
                <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Category
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    handleCategoryChange(value as TemplateCategory)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={editorOverlayRef} className="relative flex flex-1 min-h-0">
        <div className="flex flex-1 overflow-y-auto xl:overflow-hidden">
          <div className="flex-1">
            <div
              className={cn(
                getEditorShellClassName(documentResizeActive),
                'py-4 xl:h-full',
              )}
              style={editorShellStyle}
            >
              <EditorErrorBoundary>
                <DocEditor
                  key={template.id}
                  content={content}
                  onChange={handleContentChange}
                  commentsEnabled={false}
                  className="min-h-[60vh] xl:h-full"
                  editorFocusRef={editorFocusRef}
                  statsOverlayContainerRef={editorOverlayRef}
                  documentWidth={documentWidth}
                  onDocumentWidthChange={setDocumentWidth}
                  onDocumentResizeStateChange={setDocumentResizeActive}
                  aiPreviewSide={aiPanelSide}
                  onAiPreviewSideChange={setAiPanelSide}
                />
              </EditorErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      <TemplateStatusBar
        template={{
          ...template,
          content,
          category,
        }}
        saveState={saveState}
        onBack={() => {
          void handleBack()
        }}
        onCreateDocument={() => {
          void handleCreateDocument()
        }}
        onDuplicate={() => {
          void handleDuplicate()
        }}
        onDelete={
          template.isBuiltIn
            ? undefined
            : () => {
                void handleDelete()
              }
        }
        createDocumentBusy={createDocumentBusy}
        duplicateBusy={duplicateBusy}
        deleteBusy={deleteBusy}
      />
    </div>
  )
}
