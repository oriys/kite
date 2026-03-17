'use client'

import { useState, useCallback, type DragEvent, type ChangeEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getOpenapiSpecTooLargeMessage,
  OPENAPI_SPEC_MAX_SIZE,
} from '@/lib/openapi/upload'
import { Upload, Link, Loader2, CheckCircle2, FileJson } from 'lucide-react'
import { toast } from 'sonner'

interface SpecUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (source: Record<string, unknown>) => void
}

const OPENAPI_SPEC_TOO_LARGE_MESSAGE = getOpenapiSpecTooLargeMessage()

export function SpecUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: SpecUploadDialogProps) {
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = useCallback(() => {
    setName('')
    setUrl('')
    setSelectedFile(null)
    setIsDragOver(false)
    setIsSubmitting(false)
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    if (file.size > OPENAPI_SPEC_MAX_SIZE) {
      toast.error(OPENAPI_SPEC_TOO_LARGE_MESSAGE)
      return
    }

    setSelectedFile(file)
    setName((prev) => prev || file.name.replace(/\.(json|ya?ml)$/i, ''))
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for this API source')
      return
    }

    if (mode === 'file' && !selectedFile) {
      toast.error('Please upload an OpenAPI spec file')
      return
    }

    if (mode === 'url' && !url.trim()) {
      toast.error('Please enter a URL')
      return
    }

    setIsSubmitting(true)

    try {
      let res: Response

      if (mode === 'file') {
        const formData = new FormData()
        formData.set('name', name.trim())
        formData.set('file', selectedFile!)
        res = await fetch('/api/openapi', {
          method: 'POST',
          body: formData,
        })
      } else {
        const payload: Record<string, string> = {
          name: name.trim(),
          sourceUrl: url.trim(),
        }

        res = await fetch('/api/openapi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const payload = (await res.json().catch(() => null)) as
        | Record<string, unknown>
        | null

      if (!res.ok) {
        const error =
          typeof payload?.error === 'string'
            ? payload.error
            : res.status === 413
              ? OPENAPI_SPEC_TOO_LARGE_MESSAGE
              : 'Failed to create OpenAPI source'
        toast.error(error)
        return
      }

      if (!payload) {
        toast.error('Failed to create OpenAPI source')
        return
      }

      const createdName =
        typeof payload.name === 'string' ? payload.name : name.trim()

      toast.success(`API source "${createdName}" created successfully`)
      onSuccess?.(payload)
      onOpenChange(false)
      reset()
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import OpenAPI Spec</DialogTitle>
          <DialogDescription>
            Upload a JSON/YAML file or provide a URL to an OpenAPI 3.x
            specification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name field */}
          <div className="space-y-1.5">
            <label
              htmlFor="source-name"
              className="text-sm font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="source-name"
              placeholder="My API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Mode tabs */}
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as 'file' | 'url')}
          >
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1 gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1 gap-1.5">
                <Link className="h-3.5 w-3.5" />
                URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 transition-colors',
                  isDragOver
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/40',
                  selectedFile && 'border-emerald-500/40 bg-emerald-500/5',
                )}
              >
                {selectedFile ? (
                  <>
                    <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      File loaded — ready to import
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setSelectedFile(null)
                      }}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <FileJson className="mb-2 h-8 w-8 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">
                      Drag &amp; drop a{' '}
                      <span className="font-medium text-foreground">
                        .json
                      </span>{' '}
                      or{' '}
                      <span className="font-medium text-foreground">
                        .yaml
                      </span>{' '}
                      file here
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      or click to browse
                    </p>
                    <input
                      type="file"
                      accept=".json,.yaml,.yml"
                      onChange={handleFileChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-3">
              <Input
                type="url"
                placeholder="https://api.example.com/openapi.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                The URL must point to a publicly accessible OpenAPI 3.x spec
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
