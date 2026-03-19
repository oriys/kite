'use client'

import * as React from 'react'
import { CheckCircle2, FileUp } from 'lucide-react'

import {
  KNOWLEDGE_SOURCE_MAX_FILE_SIZE,
  type KnowledgeSourceImportables,
  type KnowledgeSourceFormValues,
  type KnowledgeSourceItem,
} from '@/hooks/use-knowledge-sources'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
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
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

interface KnowledgeSourceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  values: KnowledgeSourceFormValues
  onValuesChange: React.Dispatch<React.SetStateAction<KnowledgeSourceFormValues>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  error: string | null
  mutating: boolean
  importables: KnowledgeSourceImportables
  importablesError: string | null
  loadingImportables: boolean
}

const SOURCE_TYPE_LABELS: Record<KnowledgeSourceItem['sourceType'], string> = {
  document: 'Document',
  pdf: 'PDF',
  url: 'URL',
  markdown: 'Markdown',
  faq: 'FAQ',
  openapi: 'OpenAPI Schema',
  graphql: 'GraphQL Schema',
  zip: 'Zip Archive',
  asyncapi: 'AsyncAPI Schema',
  protobuf: 'Protobuf',
  rst: 'reStructuredText',
  asciidoc: 'AsciiDoc',
  csv: 'CSV / TSV',
  sql_ddl: 'SQL DDL',
  typescript_defs: 'TypeScript Definitions',
  postman: 'Postman Collection',
}

const FILE_ACCEPT: Partial<Record<KnowledgeSourceItem['sourceType'], string>> = {
  pdf: '.pdf',
  document: '.txt,.md,.doc,.docx',
  openapi: '.json,.yaml,.yml',
  graphql: '.graphql,.gql,.graphqls,.json',
  markdown: '.md,.txt',
  zip: '.zip',
  asyncapi: '.json,.yaml,.yml',
  protobuf: '.proto',
  rst: '.rst',
  asciidoc: '.adoc,.asciidoc,.asc',
  csv: '.csv,.tsv',
  sql_ddl: '.sql,.ddl',
  typescript_defs: '.d.ts,.ts',
  postman: '.json',
}

const FILE_HINT: Partial<Record<KnowledgeSourceItem['sourceType'], string>> = {
  pdf: '.pdf',
  document: '.txt, .md, .doc, .docx',
  openapi: '.json, .yaml, .yml',
  graphql: '.graphql, .gql, .graphqls, .json',
  markdown: '.md, .txt',
  zip: '.zip',
  asyncapi: '.json, .yaml, .yml',
  protobuf: '.proto',
  rst: '.rst',
  asciidoc: '.adoc, .asciidoc, .asc',
  csv: '.csv, .tsv',
  sql_ddl: '.sql, .ddl',
  typescript_defs: '.d.ts, .ts',
  postman: '.json',
}

const SHOW_URL_TYPES = new Set<string>(['url', 'pdf'])
const SHOW_CONTENT_TYPES = new Set<string>(['markdown', 'document', 'faq', 'openapi', 'graphql', 'asyncapi', 'protobuf', 'rst', 'asciidoc', 'csv', 'sql_ddl', 'typescript_defs', 'postman'])
const SHOW_FILE_TYPES = new Set<string>(['pdf', 'document', 'openapi', 'graphql', 'markdown', 'zip', 'asyncapi', 'protobuf', 'rst', 'asciidoc', 'csv', 'sql_ddl', 'typescript_defs', 'postman'])
const WORKSPACE_IMPORT_TYPES = new Set<KnowledgeSourceItem['sourceType']>([
  'document',
  'openapi',
])

export function KnowledgeSourceFormDialog({
  open,
  onOpenChange,
  mode,
  values,
  onValuesChange,
  onSubmit,
  error,
  mutating,
  importables,
  importablesError,
  loadingImportables,
}: KnowledgeSourceFormDialogProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [fileError, setFileError] = React.useState<string | null>(null)

  const supportsWorkspaceImport =
    mode === 'create' && WORKSPACE_IMPORT_TYPES.has(values.sourceType)
  const usingWorkspaceImport =
    supportsWorkspaceImport && values.sourceOrigin === 'workspace'
  const showUrl = SHOW_URL_TYPES.has(values.sourceType)
  const showBatchUrlList = mode === 'create' && values.sourceType === 'url'
  const showSingleUrl = showUrl && !showBatchUrlList && !usingWorkspaceImport
  const showContent =
    SHOW_CONTENT_TYPES.has(values.sourceType) && !values.file && !usingWorkspaceImport
  const showFile = SHOW_FILE_TYPES.has(values.sourceType) && !usingWorkspaceImport
  const acceptString = FILE_ACCEPT[values.sourceType] ?? ''
  const workspaceImportOptions = React.useMemo(() => {
    if (values.sourceType === 'openapi') {
      return importables.openapiSources.map((source) => ({
        id: source.id,
        title: source.name,
        detail: [
          source.openapiVersion || source.parsedVersion || 'OpenAPI version unknown',
          source.sourceType === 'url'
            ? source.sourceUrl || 'Remote spec'
            : 'Uploaded spec',
        ].join(' · '),
      }))
    }

    if (values.sourceType === 'document') {
      return importables.documents.map((document) => ({
        id: document.id,
        title: document.title,
        detail: [
          document.slug || 'No slug',
          document.status,
          document.preview || 'No summary yet',
        ].join(' · '),
      }))
    }

    return []
  }, [importables.documents, importables.openapiSources, values.sourceType])
  const allWorkspaceImportIds = React.useMemo(
    () => workspaceImportOptions.map((item) => item.id),
    [workspaceImportOptions],
  )
  const selectedWorkspaceImportIdSet = React.useMemo(
    () => new Set(values.workspaceImportIds),
    [values.workspaceImportIds],
  )
  const selectedWorkspaceImportCount = allWorkspaceImportIds.filter((id) =>
    selectedWorkspaceImportIdSet.has(id),
  ).length
  const allWorkspaceImportSelected =
    allWorkspaceImportIds.length > 0
    && selectedWorkspaceImportCount === allWorkspaceImportIds.length
  const someWorkspaceImportSelected =
    selectedWorkspaceImportCount > 0 && !allWorkspaceImportSelected

  const handleFileSelect = React.useCallback(
    (file: File) => {
      setFileError(null)
      if (file.size > KNOWLEDGE_SOURCE_MAX_FILE_SIZE) {
        setFileError('File too large. Maximum 10 MB.')
        return
      }
      onValuesChange((current) => ({
        ...current,
        file,
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
      }))
    },
    [onValuesChange],
  )

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const removeFile = React.useCallback(() => {
    onValuesChange((current) => ({ ...current, file: null }))
    setFileError(null)
  }, [onValuesChange])

  // Clear file when source type changes
  const prevTypeRef = React.useRef(values.sourceType)
  React.useEffect(() => {
    if (prevTypeRef.current !== values.sourceType) {
      prevTypeRef.current = values.sourceType
      onValuesChange((current) => ({
        ...current,
        file: null,
        sourceOrigin: WORKSPACE_IMPORT_TYPES.has(values.sourceType)
          ? current.sourceOrigin
          : 'manual',
        workspaceImportIds:
          WORKSPACE_IMPORT_TYPES.has(values.sourceType)
            ? []
            : [],
      }))
      setFileError(null)
    }
  }, [values.sourceType, onValuesChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Add knowledge source' : 'Edit knowledge source'}
            </DialogTitle>
            <DialogDescription>
              Add content that the AI assistant can reference during conversations.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto py-4">
            <FieldGroup className="gap-4">
              {!showBatchUrlList && !usingWorkspaceImport ? (
                <Field>
                  <FieldLabel htmlFor="ks-title">Title</FieldLabel>
                  <FieldContent>
                    <Input
                      id="ks-title"
                      value={values.title}
                      onChange={(event) =>
                        onValuesChange((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="API Authentication Guide"
                      aria-invalid={Boolean(error && !values.title.trim())}
                    />
                    <FieldDescription>
                      A descriptive name for this knowledge source.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              ) : null}

              <Field>
                <FieldLabel htmlFor="ks-source-type">Source type</FieldLabel>
                <FieldContent>
                  <Select
                    value={values.sourceType}
                    onValueChange={(value: KnowledgeSourceItem['sourceType']) =>
                      onValuesChange((current) => ({
                        ...current,
                        sourceType: value,
                      }))
                    }
                  >
                    <SelectTrigger id="ks-source-type" className="w-full">
                      <SelectValue placeholder="Select source type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    The format of the content being added.
                  </FieldDescription>
                </FieldContent>
              </Field>

              {supportsWorkspaceImport ? (
                <Field>
                  <FieldLabel>Source origin</FieldLabel>
                  <FieldContent>
                    <RadioGroup
                      value={values.sourceOrigin}
                        onValueChange={(nextValue) =>
                          onValuesChange((current) => ({
                            ...current,
                            sourceOrigin: nextValue === 'workspace' ? 'workspace' : 'manual',
                            file: nextValue === 'workspace' ? null : current.file,
                            title: nextValue === 'workspace' ? '' : current.title,
                            workspaceImportIds:
                              nextValue === 'workspace'
                                ? current.workspaceImportIds
                              : [],
                        }))
                      }
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      <label className="flex items-start gap-3 rounded-md border border-border/70 p-3 text-sm">
                        <RadioGroupItem
                          value="manual"
                          id="ks-source-origin-manual"
                          className="mt-0.5"
                        />
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            Paste or upload
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Add standalone content directly into the knowledge base.
                          </p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 rounded-md border border-border/70 p-3 text-sm">
                        <RadioGroupItem
                          value="workspace"
                          id="ks-source-origin-workspace"
                          className="mt-0.5"
                        />
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            From workspace
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Import existing {values.sourceType === 'openapi' ? 'OpenAPI specs' : 'documents'} from this workspace.
                          </p>
                        </div>
                      </label>
                    </RadioGroup>
                    <FieldDescription>
                      Workspace imports create one knowledge source per selected item.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              ) : null}

              {usingWorkspaceImport ? (
                <Field>
                  <FieldLabel>
                    Select {values.sourceType === 'openapi' ? 'OpenAPI sources' : 'documents'}
                  </FieldLabel>
                  <FieldContent>
                    <div className="rounded-md border border-border/70">
                      <ScrollArea className="h-64">
                        <div className="grid gap-1.5 p-3">
                          {loadingImportables ? (
                            <p className="px-1 py-2 text-sm text-muted-foreground">
                              Loading workspace content…
                            </p>
                          ) : importablesError ? (
                            <p className="px-1 py-2 text-sm text-destructive">
                              {importablesError}
                            </p>
                          ) : workspaceImportOptions.length === 0 ? (
                            <p className="px-1 py-2 text-sm text-muted-foreground">
                              No {values.sourceType === 'openapi' ? 'OpenAPI sources' : 'documents'} available to import yet.
                            </p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                                <label className="flex min-w-0 items-center gap-3 text-sm">
                                  <Checkbox
                                    checked={
                                      allWorkspaceImportSelected
                                        ? true
                                        : someWorkspaceImportSelected
                                          ? 'indeterminate'
                                          : false
                                    }
                                    onCheckedChange={(nextChecked) =>
                                      onValuesChange((current) => ({
                                        ...current,
                                        workspaceImportIds:
                                          nextChecked === true
                                            ? allWorkspaceImportIds
                                            : [],
                                      }))
                                    }
                                  />
                                  <span className="font-medium text-foreground">
                                    Select all
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {selectedWorkspaceImportCount}/{allWorkspaceImportIds.length}
                                  </span>
                                </label>
                                {selectedWorkspaceImportCount > 0 ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() =>
                                      onValuesChange((current) => ({
                                        ...current,
                                        workspaceImportIds: [],
                                      }))
                                    }
                                  >
                                    Clear
                                  </Button>
                                ) : null}
                              </div>

                              {workspaceImportOptions.map((item) => {
                                const checked = selectedWorkspaceImportIdSet.has(item.id)
                                return (
                                  <label
                                    key={item.id}
                                    className={cn(
                                      'flex items-start gap-3 rounded-md border border-transparent px-3 py-2 text-sm transition-colors',
                                      checked
                                        ? 'bg-accent/50 text-foreground'
                                        : 'hover:bg-muted/40',
                                    )}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(nextChecked) =>
                                        onValuesChange((current) => ({
                                          ...current,
                                          workspaceImportIds: nextChecked
                                            ? [...current.workspaceImportIds, item.id]
                                            : current.workspaceImportIds.filter((value) => value !== item.id),
                                        }))
                                      }
                                      className="mt-0.5"
                                    />
                                    <div className="min-w-0 space-y-1">
                                      <div className="truncate font-medium text-foreground">
                                        {item.title}
                                      </div>
                                      <p className="line-clamp-2 text-xs text-muted-foreground">
                                        {item.detail}
                                      </p>
                                    </div>
                                  </label>
                                )
                              })}
                            </>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                    <FieldDescription>
                      {values.workspaceImportIds.length === 0
                        ? `Choose one or more ${values.sourceType === 'openapi' ? 'OpenAPI sources' : 'documents'} to import.`
                        : `${values.workspaceImportIds.length} item${values.workspaceImportIds.length === 1 ? '' : 's'} selected.`}
                    </FieldDescription>
                  </FieldContent>
                </Field>
              ) : null}

              {/* File upload zone */}
              {showFile ? (
                <Field>
                  <FieldLabel>File</FieldLabel>
                  <FieldContent>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setIsDragOver(true)
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-8 transition-colors',
                        isDragOver
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-muted-foreground/25 hover:border-muted-foreground/40',
                        values.file && 'border-emerald-500/40 bg-emerald-500/5',
                      )}
                    >
                      {values.file ? (
                        <>
                          <CheckCircle2 className="mb-2 size-7 text-emerald-500" />
                          <p className="text-sm font-medium text-foreground">
                            {values.file.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            File loaded — ready to import
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            type="button"
                            onClick={removeFile}
                          >
                            Remove
                          </Button>
                        </>
                      ) : (
                        <>
                          <FileUp className="mb-2 size-7 text-muted-foreground/60" />
                          <p className="text-sm text-muted-foreground">
                            Drag & drop a file here, or{' '}
                            <span className="font-medium text-foreground">
                              click to browse
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Accepts {FILE_HINT[values.sourceType]} — max 10 MB
                          </p>
                          <input
                            type="file"
                            accept={acceptString}
                            onChange={handleFileChange}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                        </>
                      )}
                    </div>
                    {fileError ? (
                      <p className="mt-1 text-sm text-destructive">{fileError}</p>
                    ) : null}
                    {!values.file && SHOW_CONTENT_TYPES.has(values.sourceType) ? (
                      <FieldDescription>
                        Or paste content directly below.
                      </FieldDescription>
                    ) : null}
                  </FieldContent>
                </Field>
              ) : null}

              {showBatchUrlList ? (
                <Field>
                  <FieldLabel htmlFor="ks-source-urls">Source URLs</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="ks-source-urls"
                      value={values.sourceUrlsText}
                      onChange={(event) =>
                        onValuesChange((current) => ({
                          ...current,
                          sourceUrlsText: event.target.value,
                        }))
                      }
                      placeholder={[
                        'https://example.com/docs/authentication',
                        'https://example.com/docs/orders',
                        'https://example.com/docs/webhooks',
                      ].join('\n')}
                      rows={8}
                      className="font-mono text-xs"
                    />
                    <FieldDescription>
                      Paste one public URL per line. Kite will create one knowledge
                      source for each URL and generate titles automatically. You can
                      rename them later.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              ) : null}

              {showSingleUrl ? (
                <Field>
                  <FieldLabel htmlFor="ks-source-url">Source URL</FieldLabel>
                  <FieldContent>
                    <Input
                      id="ks-source-url"
                      value={values.sourceUrl}
                      onChange={(event) =>
                        onValuesChange((current) => ({
                          ...current,
                          sourceUrl: event.target.value,
                        }))
                      }
                      placeholder="https://example.com/docs/api-reference"
                    />
                    <FieldDescription>
                      The URL to fetch content from.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              ) : null}

              {showContent ? (
                <Field>
                  <FieldLabel htmlFor="ks-content">Content</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="ks-content"
                      value={values.rawContent}
                      onChange={(event) =>
                        onValuesChange((current) => ({
                          ...current,
                          rawContent: event.target.value,
                        }))
                      }
                      placeholder={
                        values.sourceType === 'faq'
                          ? '[{"question": "How do I authenticate?", "answer": "Use an API key in the Authorization header."}]'
                          : values.sourceType === 'openapi'
                            ? '{"openapi": "3.0.0", "info": {"title": "My API", ...}}'
                            : values.sourceType === 'graphql'
                              ? 'type Query {\n  user(id: ID!): User\n}\n\ntype User {\n  id: ID!\n  name: String!\n}'
                              : 'Paste your content here…'
                      }
                      rows={8}
                      className="font-mono text-xs"
                    />
                    <FieldDescription>
                      {values.sourceType === 'faq'
                        ? 'JSON array of {question, answer} pairs.'
                        : values.sourceType === 'openapi'
                          ? 'Paste an OpenAPI 3.x JSON or YAML specification.'
                          : values.sourceType === 'graphql'
                            ? 'Paste a GraphQL SDL schema or introspection JSON.'
                            : 'The raw content to be indexed.'}
                    </FieldDescription>
                  </FieldContent>
                </Field>
              ) : null}
            </FieldGroup>

            {error ? (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={mutating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutating}>
              {mutating
                ? mode === 'create'
                  ? 'Adding…'
                  : 'Saving…'
                : mode === 'create'
                  ? 'Add Source'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
