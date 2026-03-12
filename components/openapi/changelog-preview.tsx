'use client'

import { useCallback, useState } from 'react'
import { FileText, Copy, Check, Loader2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ChangelogSummary {
  added: number
  changed: number
  removed: number
}

interface ChangelogPreviewProps {
  sourceId: string
  className?: string
}

export function ChangelogPreview({
  sourceId,
  className,
}: ChangelogPreviewProps) {
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [summary, setSummary] = useState<ChangelogSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedDocId, setSavedDocId] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setMarkdown(null)
    setSummary(null)
    setSavedDocId(null)

    try {
      const res = await fetch(`/api/openapi/${sourceId}/changelog`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to generate changelog')
      }

      const data = await res.json()
      setMarkdown(data.markdown)
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }, [sourceId])

  const saveAsDocument = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/openapi/${sourceId}/changelog?createDoc=true`,
        { method: 'POST' },
      )

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to save document')
      }

      const data = await res.json()
      setMarkdown(data.markdown)
      setSummary(data.summary)
      setSavedDocId(data.documentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setSaving(false)
    }
  }, [sourceId])

  const copyToClipboard = useCallback(async () => {
    if (!markdown) return
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [markdown])

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-neutral-500" />
              Changelog
            </CardTitle>
            <CardDescription>
              Compare current spec against the latest snapshot
            </CardDescription>
          </div>
          <Button
            onClick={generate}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {loading ? 'Generating…' : 'Generate Changelog'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </div>
        )}

        {summary && (
          <div className="mb-3 flex gap-3 text-xs font-medium">
            <span className="text-emerald-600 dark:text-emerald-400">
              +{summary.added} added
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              ~{summary.changed} changed
            </span>
            <span className="text-rose-600 dark:text-rose-400">
              -{summary.removed} removed
            </span>
          </div>
        )}

        {markdown && (
          <>
            <ScrollArea className="h-[400px] rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
              <pre className="whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                {markdown}
              </pre>
            </ScrollArea>

            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={copyToClipboard}
                size="sm"
                variant="ghost"
                className="gap-1.5"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied' : 'Copy Markdown'}
              </Button>

              <Button
                onClick={saveAsDocument}
                disabled={saving || !!savedDocId}
                size="sm"
                variant="ghost"
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5" />
                )}
                {savedDocId ? 'Saved' : 'Save as Document'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
