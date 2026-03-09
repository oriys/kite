'use client'

import Link from 'next/link'
import { FileText, Clock, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { type Doc, STATUS_CONFIG, docs as docStore } from '@/lib/documents'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface DocListProps {
  documents: Doc[]
  onDelete: (id: string) => void
  className?: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function excerpt(content: string, maxLen = 120): string {
  const plain = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
  return plain.length > maxLen ? plain.slice(0, maxLen) + '…' : plain
}

export function DocList({ documents, onDelete, className }: DocListProps) {
  if (documents.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-20 text-center', className)}>
        <div className="rounded-full bg-muted/60 p-4 mb-4">
          <FileText className="size-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No documents yet</p>
        <p className="text-sm text-muted-foreground">
          Create your first document to get started.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {documents.map((doc) => {
        const config = STATUS_CONFIG[doc.status]
        const wc = docStore.wordCount(doc.content)

        return (
          <Link key={doc.id} href={`/docs/${doc.id}`} className="group">
            <Card className="h-full transition-shadow hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_24px_60px_-32px_rgba(15,23,42,0.25)]">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium leading-5 line-clamp-2 group-hover:text-accent-foreground transition-colors">
                    {doc.title || 'Untitled'}
                  </CardTitle>
                  <StatusBadge
                    label={config.label}
                    tone={config.tone as StatusTone}
                    className="shrink-0"
                  />
                </div>
                <CardDescription className="line-clamp-2 text-xs leading-5">
                  {excerpt(doc.content) || 'Empty document'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(doc.updatedAt)}
                    </span>
                    <span>{wc.toLocaleString()} words</span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.preventDefault()}
                        aria-label={`Delete ${doc.title}`}
                      >
                        <Trash2 className="size-3 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.preventDefault()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete document</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently delete &ldquo;{doc.title}&rdquo;? This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={(e) => {
                            e.preventDefault()
                            onDelete(doc.id)
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
