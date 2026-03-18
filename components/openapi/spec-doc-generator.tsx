'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Sparkles,
  FileText,
  Loader2,
  CheckCircle2,
  Search,
  ShieldCheck,
  TriangleAlert,
  ScanText,
  Workflow,
  LayoutTemplate,
  BookOpenCheck,
} from 'lucide-react'
import { MarkdownPreview } from '@/components/docs/markdown-preview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getDocEditorHref } from '@/lib/documents'
import { extractMarkdownHeadings } from '@/lib/markdown-outline'
import {
  getTemplateCategoryLabel,
  OPENAPI_DOCUMENT_TYPE_OPTIONS,
  type OpenApiDocumentType,
} from '@/lib/openapi/document-types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const METHOD_STYLES: Record<string, string> = {
  GET: 'border-method-get/25 bg-method-get/10 text-method-get',
  POST: 'border-method-post/25 bg-method-post/10 text-method-post',
  PUT: 'border-method-put/25 bg-method-put/10 text-method-put',
  PATCH: 'border-method-patch/25 bg-method-patch/10 text-method-patch',
  DELETE: 'border-method-delete/25 bg-method-delete/10 text-method-delete',
}

const DOC_SECTIONS = [
  { label: 'Interface & method', icon: ScanText },
  { label: 'Authentication', icon: ShieldCheck },
  { label: 'Request & response', icon: FileText },
  { label: 'Error handling', icon: TriangleAlert },
  { label: 'Scenarios & examples', icon: Workflow },
  { label: 'Risk notes', icon: Sparkles },
] as const

const TEMPLATE_PREVIEW_CONTENT_LIMIT = 4_000
const TEMPLATE_OUTLINE_PREVIEW_LIMIT = 10

interface Endpoint {
  id: string
  path: string
  method: string
  operationId?: string | null
  summary?: string | null
  description?: string | null
  tags: string[]
}

interface GeneratedDoc {
  documentId: string
  title: string
  mode: 'ai' | 'template' | 'empty'
}

interface TemplateOption {
  id: string
  name: string
  description: string
  category: string
}

interface TemplateDetail extends TemplateOption {
  content: string
}

interface SpecDocGeneratorProps {
  sourceId: string
  endpoints: Endpoint[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseTemplateDetail(value: unknown): TemplateDetail | null {
  if (!isRecord(value)) return null

  const id = typeof value.id === 'string' ? value.id : ''
  const name = typeof value.name === 'string' ? value.name : ''

  if (!id || !name) return null

  return {
    id,
    name,
    description: typeof value.description === 'string' ? value.description : '',
    category: typeof value.category === 'string' ? value.category : 'custom',
    content: typeof value.content === 'string' ? value.content : '',
  }
}

function buildTemplatePreviewMessage(input: {
  shouldUseAi: boolean
  selectedEndpointCount: number
  hasPrompt: boolean
}) {
  if (!input.shouldUseAi) {
    return 'If you create now, the document will start directly from this template content.'
  }

  if (input.selectedEndpointCount > 0 && input.hasPrompt) {
    return 'AI will use this template as the structure, then merge your selected endpoints and custom prompt into one document.'
  }

  if (input.selectedEndpointCount > 0) {
    return 'AI will use this template as the structure, then map the selected endpoints into the final document.'
  }

  return 'AI will keep this template structure while expanding the document from your prompt.'
}

function getTemplatePreviewContent(content: string) {
  if (content.length <= TEMPLATE_PREVIEW_CONTENT_LIMIT) {
    return {
      content,
      truncated: false,
    }
  }

  return {
    content: content.slice(0, TEMPLATE_PREVIEW_CONTENT_LIMIT).trimEnd(),
    truncated: true,
  }
}

export function SpecDocGenerator({
  sourceId,
  endpoints,
}: SpecDocGeneratorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GeneratedDoc | null>(null)
  const [search, setSearch] = useState('')
  const [prompt, setPrompt] = useState('')
  const [documentType, setDocumentType] = useState<'__none__' | OpenApiDocumentType>('__none__')
  const [templateId, setTemplateId] = useState<string>('__none__')
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateDetails, setTemplateDetails] = useState<
    Record<string, TemplateDetail>
  >({})
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false)
  const [templatePreviewError, setTemplatePreviewError] = useState<string | null>(
    null,
  )

  const filteredEndpoints = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return endpoints

    return endpoints.filter((endpoint) =>
      [
        endpoint.path,
        endpoint.method,
        endpoint.operationId ?? '',
        endpoint.summary ?? '',
        endpoint.description ?? '',
        endpoint.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [endpoints, search])

  const selectedEndpointCount = selected.size
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  )
  const selectedTemplateDetail =
    templateId !== '__none__' ? templateDetails[templateId] ?? null : null
  const hasPrompt = prompt.trim().length > 0
  const hasTemplate = templateId !== '__none__'
  const shouldUseAi = selectedEndpointCount > 0 || hasPrompt
  const templatePreviewMessage = useMemo(
    () =>
      buildTemplatePreviewMessage({
        shouldUseAi,
        selectedEndpointCount,
        hasPrompt,
      }),
    [hasPrompt, selectedEndpointCount, shouldUseAi],
  )
  const actionLabel = generating
    ? 'Creating…'
    : shouldUseAi
      ? 'Create with AI'
      : hasTemplate
        ? 'Create from template'
        : 'Create blank draft'
  const actionDescription = shouldUseAi
    ? 'We will merge the selected interfaces, prompt, type, and template into one document.'
    : hasTemplate
      ? 'We will create one document directly from the selected template.'
      : 'Leave endpoints, prompt, and template empty to start with a blank draft.'
  const selectedPreview = useMemo(
    () => endpoints.filter((endpoint) => selected.has(endpoint.id)).slice(0, 3),
    [endpoints, selected],
  )
  const templateOutline = useMemo(
    () =>
      extractMarkdownHeadings(selectedTemplateDetail?.content ?? '', {
        maxLevel: 4,
      }),
    [selectedTemplateDetail?.content],
  )
  const templateOutlinePreview = useMemo(
    () => templateOutline.slice(0, TEMPLATE_OUTLINE_PREVIEW_LIMIT),
    [templateOutline],
  )
  const templatePreview = useMemo(
    () => getTemplatePreviewContent(selectedTemplateDetail?.content ?? ''),
    [selectedTemplateDetail?.content],
  )

  useEffect(() => {
    let active = true

    const loadTemplates = async () => {
      setTemplatesLoading(true)
      try {
        const response = await fetch('/api/templates')
        if (!response.ok) {
          throw new Error('Failed to load templates')
        }

        const data = await response.json()
        if (active) {
          setTemplates(Array.isArray(data) ? data : [])
        }
      } catch {
        if (active) {
          toast.error('Failed to load document templates')
        }
      } finally {
        if (active) {
          setTemplatesLoading(false)
        }
      }
    }

    loadTemplates()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    if (!hasTemplate) {
      setTemplatePreviewLoading(false)
      setTemplatePreviewError(null)
      return () => {
        active = false
      }
    }

    if (selectedTemplateDetail) {
      setTemplatePreviewError(null)
      setTemplatePreviewLoading(false)
      return () => {
        active = false
      }
    }

    const loadTemplatePreview = async () => {
      setTemplatePreviewLoading(true)
      setTemplatePreviewError(null)

      try {
        const response = await fetch(`/api/templates/${templateId}`)
        if (!response.ok) {
          throw new Error('Failed to load template preview')
        }

        const data: unknown = await response.json()
        const detail = parseTemplateDetail(data)
        if (!detail) {
          throw new Error('Template preview data is invalid')
        }

        if (active) {
          setTemplateDetails((prev) => ({
            ...prev,
            [detail.id]: detail,
          }))
        }
      } catch (error) {
        if (active) {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load template preview'
          setTemplatePreviewError(message)
          toast.error(message)
        }
      } finally {
        if (active) {
          setTemplatePreviewLoading(false)
        }
      }
    }

    void loadTemplatePreview()

    return () => {
      active = false
    }
  }, [hasTemplate, selectedTemplateDetail, templateId])

  const toggleVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      const visibleIds = filteredEndpoints.map((endpoint) => endpoint.id)
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => next.has(id))

      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }

      return next
    })
  }, [filteredEndpoints])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setResult(null)

    try {
      const res = await fetch('/api/ai/generate-docs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          openapiSourceId: sourceId,
          endpointIds: Array.from(selected),
          prompt,
          documentType: documentType === '__none__' ? undefined : documentType,
          templateId: templateId === '__none__' ? undefined : templateId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Generation failed')
      }

      const data = await res.json()
      if (!data.document?.documentId) {
        throw new Error('Document was not created')
      }

      setResult(data.document)

      const modeLabel =
        data.document.mode === 'ai'
          ? 'AI document created'
          : data.document.mode === 'template'
            ? 'Template document created'
            : 'Blank document created'
      toast.success(modeLabel)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.85fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-sm font-medium">
                OpenAPI document creator
              </CardTitle>
              <CardDescription className="text-xs">
                Create one document from multiple selected endpoints, your prompt, document type, and an optional template.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-start">
              <Button
                variant="outline"
                size="xs"
                onClick={toggleVisible}
                disabled={filteredEndpoints.length === 0}
              >
                {filteredEndpoints.length > 0 &&
                filteredEndpoints.every((endpoint) => selected.has(endpoint.id))
                  ? 'Clear visible'
                  : 'Select visible'}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by path, method, summary, or tag"
                className="h-9 pl-9 text-sm"
                disabled={endpoints.length === 0}
                aria-label="Search endpoints for documentation generation"
              />
            </label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{selectedEndpointCount} selected</span>
              <span aria-hidden="true">•</span>
              <span>
                {endpoints.length === 0
                  ? '0 available'
                  : `${filteredEndpoints.length} visible`}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {endpoints.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No endpoints are available in this spec yet. You can still create a
              template-based document, prompt-based draft, or blank draft from
              the panel on the right.
            </div>
          ) : filteredEndpoints.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No endpoints match your search yet. Try a different path, method,
              or tag.
            </div>
          ) : (
            <div className="max-h-[34rem] divide-y overflow-auto rounded-md border">
              {filteredEndpoints.map((ep) => {
                const isSelected = selected.has(ep.id)
                return (
                  <label
                    key={ep.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/40',
                      isSelected && 'bg-accent/5',
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(ep.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex min-w-[4.2rem] items-center justify-center rounded border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide',
                            METHOD_STYLES[ep.method.toUpperCase()] ??
                              'border-border/50 bg-muted text-muted-foreground',
                          )}
                        >
                          {ep.method}
                        </span>
                        <code className="min-w-0 truncate text-xs font-medium text-foreground">
                          {ep.path}
                        </code>
                        {ep.tags[0] && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            {ep.tags[0]}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {ep.summary ?? ep.description ?? 'No summary provided'}
                        </span>
                        {ep.operationId && (
                          <>
                            <span aria-hidden="true">•</span>
                            <span className="font-mono">{ep.operationId}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Document settings
            </CardTitle>
            <CardDescription className="text-xs">
              Select the interfaces to merge, add custom instructions, choose
              the document type, and optionally start from a template.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Document type
                </label>
                <Select value={documentType} onValueChange={(value) => setDocumentType(value as '__none__' | OpenApiDocumentType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Use a general document shape" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">General document</SelectItem>
                    {OPENAPI_DOCUMENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {documentType !== '__none__' && (
                  <p className="text-xs text-muted-foreground">
                    {
                      OPENAPI_DOCUMENT_TYPE_OPTIONS.find(
                        (option) => option.value === documentType,
                      )?.description
                    }
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Template
                </label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        templatesLoading ? 'Loading templates…' : 'No template'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No template</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="size-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-foreground">
                        {selectedTemplate.name}
                      </p>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {getTemplateCategoryLabel(selectedTemplate.category)}
                      </Badge>
                    </div>
                    {selectedTemplate.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedTemplate.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Prompt
                </label>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Optional: describe the audience, workflow, tone, or extra topics the document should emphasize."
                  className="min-h-[132px] text-sm"
                />
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="size-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-foreground">
                    Creation mode
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {actionDescription}
                </p>

                {selectedPreview.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Selected now
                    </p>
                    {selectedPreview.map((endpoint) => (
                      <div
                        key={endpoint.id}
                        className="flex items-center gap-2 text-xs text-foreground"
                      >
                        <span className="font-mono text-muted-foreground">
                          {endpoint.method}
                        </span>
                        <code className="truncate">{endpoint.path}</code>
                      </div>
                    ))}
                    {selectedEndpointCount > selectedPreview.length && (
                      <p className="text-xs text-muted-foreground">
                        +{selectedEndpointCount - selectedPreview.length} more selected endpoint
                        {selectedEndpointCount - selectedPreview.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full gap-2"
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : shouldUseAi ? (
                  <Sparkles className="size-4" />
                ) : hasTemplate ? (
                  <LayoutTemplate className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
                {actionLabel}
              </Button>

              <p className="text-xs text-muted-foreground">
                Leave endpoints, prompt, and template empty if you just want a blank draft.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Template preview
            </CardTitle>
            <CardDescription className="text-xs">
              Review the template structure before you create the document.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {!hasTemplate ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Choose a template to preview its section structure and starter content before generating.
              </div>
            ) : templatePreviewLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-md border border-border/60 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading template preview…
              </div>
            ) : templatePreviewError ? (
              <div className="rounded-md border border-dashed border-destructive/40 px-4 py-8 text-sm text-muted-foreground">
                {templatePreviewError}
              </div>
            ) : selectedTemplateDetail ? (
              <div className="space-y-3">
                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="size-3.5 text-muted-foreground" />
                    <p className="truncate text-xs font-medium text-foreground">
                      {selectedTemplateDetail.name}
                    </p>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {getTemplateCategoryLabel(selectedTemplateDetail.category)}
                    </Badge>
                  </div>
                  {selectedTemplateDetail.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedTemplateDetail.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {templatePreviewMessage}
                  </p>
                </div>

                <div className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Section outline
                    </p>
                    {templateOutline.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {templateOutline.length} section
                        {templateOutline.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {templateOutlinePreview.length > 0 ? (
                    <div className="mt-3 space-y-1.5">
                      {templateOutlinePreview.map((heading) => (
                        <div
                          key={`${heading.id}-${heading.level}`}
                          className="flex items-start gap-2 text-sm text-foreground"
                          style={{
                            paddingLeft: `${Math.max(heading.level - 1, 0) * 12}px`,
                          }}
                        >
                          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            H{heading.level}
                          </span>
                          <span className="line-clamp-1 min-w-0 flex-1">
                            {heading.text}
                          </span>
                        </div>
                      ))}
                      {templateOutline.length > templateOutlinePreview.length && (
                        <p className="pt-1 text-xs text-muted-foreground">
                          +{templateOutline.length - templateOutlinePreview.length} more
                          section
                          {templateOutline.length - templateOutlinePreview.length === 1
                            ? ''
                            : 's'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      This template does not define Markdown headings yet. Use the content preview below to inspect its structure.
                    </p>
                  )}
                </div>

                <div className="rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Content snapshot
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {templatePreview.truncated ? 'Preview truncated' : 'Full preview'}
                    </span>
                  </div>
                  <div className="mt-3 max-h-72 overflow-auto rounded-md border border-border/50 bg-background/80 px-3 py-3">
                    <MarkdownPreview
                      content={templatePreview.content}
                      className="max-w-none text-sm [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:leading-6"
                    />
                  </div>
                  {templatePreview.truncated && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      The preview is shortened for readability. The full template will still be used when the document is created.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Select a template to load its preview.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              What AI can synthesize
            </CardTitle>
            <CardDescription className="text-xs">
              When AI creation is used, the document can merge these inputs into one coherent output.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {DOC_SECTIONS.map((section) => {
                const Icon = section.icon
                return (
                  <div
                    key={section.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    <Icon className="size-3" />
                    {section.label}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-[oklch(0.42_0.10_145)]" />
                Document created
              </CardTitle>
              <CardDescription className="text-xs">
                Open the draft in the editor to refine copy, add screenshots, or continue structuring the document.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <a
                href={getDocEditorHref(result.documentId)}
                className="flex items-center gap-3 rounded-md border px-3 py-3 text-sm transition-colors hover:bg-muted/40"
              >
                <FileText className="size-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{result.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.mode === 'ai'
                      ? 'Created with AI synthesis'
                      : result.mode === 'template'
                        ? 'Created from template'
                        : 'Created as a blank draft'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Open in editor →
                </span>
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
