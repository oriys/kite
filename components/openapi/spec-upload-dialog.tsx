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
import { Upload, Link, Loader2, CheckCircle2, FileJson } from 'lucide-react'
import { toast } from 'sonner'

interface SpecUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (source: Record<string, unknown>) => void
}

export function SpecUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: SpecUploadDialogProps) {
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = useCallback(() => {
    setName('')
    setUrl('')
    setFileContent(null)
    setFileName(null)
    setIsDragOver(false)
    setIsSubmitting(false)
  }, [])

  const handleFileRead = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setFileContent(content)
      setFileName(file.name)
      // Auto-fill name from filename if empty
      setName((prev) => prev || file.name.replace(/\.(json|ya?ml)$/i, ''))
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileRead(file)
    },
    [handleFileRead],
  )

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileRead(file)
    },
    [handleFileRead],
  )

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for this API source')
      return
    }

    if (mode === 'file' && !fileContent) {
      toast.error('Please upload an OpenAPI spec file')
      return
    }

    if (mode === 'url' && !url.trim()) {
      toast.error('Please enter a URL')
      return
    }

    setIsSubmitting(true)

    try {
      const payload: Record<string, string> = { name: name.trim() }
      if (mode === 'file') {
        payload.rawContent = fileContent!
      } else {
        payload.sourceUrl = url.trim()
      }

      const res = await fetch('/api/openapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to create OpenAPI source')
        return
      }

      toast.success(`API source "${data.name}" created successfully`)
      onSuccess?.(data)
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
                  fileContent && 'border-emerald-500/40 bg-emerald-500/5',
                )}
              >
                {fileContent ? (
                  <>
                    <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      File loaded — ready to import
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setFileContent(null)
                        setFileName(null)
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
