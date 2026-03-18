'use client'

import * as React from 'react'
import { CheckCircle2, FileUp } from 'lucide-react'

import {
  KNOWLEDGE_SOURCE_MAX_FILE_SIZE,
  type KnowledgeSourceFormValues,
  type KnowledgeSourceItem,
} from '@/hooks/use-knowledge-sources'
import { cn } from '@/lib/utils'
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

export function KnowledgeSourceFormDialog({
  open,
  onOpenChange,
  mode,
  values,
  onValuesChange,
  onSubmit,
  error,
  mutating,
}: KnowledgeSourceFormDialogProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [fileError, setFileError] = React.useState<string | null>(null)

  const showUrl = SHOW_URL_TYPES.has(values.sourceType)
  const showContent = SHOW_CONTENT_TYPES.has(values.sourceType) && !values.file
  const showFile = SHOW_FILE_TYPES.has(values.sourceType)
  const acceptString = FILE_ACCEPT[values.sourceType] ?? ''

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
      onValuesChange((current) => ({ ...current, file: null }))
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

              {showUrl ? (
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
