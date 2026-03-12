'use client'

import { useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Copy, Download, FileCode } from 'lucide-react'

interface TypeExportDialogProps {
  sourceId: string
  sourceName: string
  children?: React.ReactNode
}

type Format = 'typescript' | 'jsonschema'

export function TypeExportDialog({
  sourceId,
  sourceName,
  children,
}: TypeExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<Format>('typescript')
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const generate = useCallback(
    async (fmt: Format) => {
      setLoading(true)
      setContent('')
      try {
        const res = await fetch(
          `/api/openapi/${sourceId}/types?format=${fmt}`,
        )
        if (!res.ok) {
          toast.error('Failed to generate types')
          return
        }
        const text = await res.text()
        setContent(text)
      } catch {
        toast.error('Failed to generate types')
      } finally {
        setLoading(false)
      }
    },
    [sourceId],
  )

  function handleFormatChange(value: string) {
    const fmt = value as Format
    setFormat(fmt)
    generate(fmt)
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen && !content) {
      generate(format)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  function handleDownload() {
    const mime = format === 'typescript' ? 'text/plain' : 'application/json'
    const filename = format === 'typescript' ? 'api-types.d.ts' : 'api-schemas.json'

    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <FileCode className="mr-2 h-4 w-4" />
            Export Types
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Types — {sourceName}</DialogTitle>
          <DialogDescription>
            Generate type definitions from your API specification.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Select value={format} onValueChange={handleFormatChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="typescript">TypeScript</SelectItem>
              <SelectItem value="jsonschema">JSON Schema</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              disabled={!content || loading}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={!content || loading}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : content ? (
          <ScrollArea className="h-[400px] w-full rounded-md border bg-zinc-950 p-4">
            <pre className="font-mono text-xs leading-relaxed text-zinc-100">
              <code>{content}</code>
            </pre>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No types generated. Select a format and try again.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
