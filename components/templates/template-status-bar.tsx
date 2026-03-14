'use client'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  FileText,
  Loader2,
  Trash2,
  WifiOff,
} from 'lucide-react'

import { cn, wordCount } from '@/lib/utils'
import { getTemplateCategoryLabel, type Template } from '@/lib/templates'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

export type TemplateSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline'

interface TemplateStatusBarProps {
  template: Pick<Template, 'content' | 'updatedAt' | 'usageCount' | 'category' | 'isBuiltIn'>
  saveState?: TemplateSaveState
  onBack?: () => void
  onCreateDocument: () => void
  onDuplicate: () => void
  onDelete?: () => void
  createDocumentBusy?: boolean
  duplicateBusy?: boolean
  deleteBusy?: boolean
  className?: string
}

function getSaveStateMeta(saveState: TemplateSaveState) {
  switch (saveState) {
    case 'saving':
      return {
        icon: Loader2,
        label: 'Saving…',
        className: 'text-muted-foreground',
        iconClassName: 'animate-spin',
      }
    case 'saved':
      return {
        icon: Check,
        label: 'Saved',
        className: 'text-tone-success-text',
        iconClassName: '',
      }
    case 'error':
      return {
        icon: AlertCircle,
        label: 'Save failed',
        className: 'text-destructive',
        iconClassName: '',
      }
    case 'offline':
      return {
        icon: WifiOff,
        label: 'Offline',
        className: 'text-tone-caution-text',
        iconClassName: '',
      }
    default:
      return {
        icon: Clock,
        label: 'Ready',
        className: 'text-muted-foreground',
        iconClassName: '',
      }
  }
}

export function TemplateStatusBar({
  template,
  saveState = 'idle',
  onBack,
  onCreateDocument,
  onDuplicate,
  onDelete,
  createDocumentBusy = false,
  duplicateBusy = false,
  deleteBusy = false,
  className,
}: TemplateStatusBarProps) {
  const saveStateMeta = getSaveStateMeta(saveState)
  const SaveIcon = saveStateMeta.icon
  const words = wordCount(template.content)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-2',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onBack}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>

        <span className={cn('inline-flex items-center gap-1.5', saveStateMeta.className)}>
          <SaveIcon className={cn('size-3.5', saveStateMeta.iconClassName)} />
          {saveStateMeta.label}
        </span>

        <Badge variant="outline" className="h-5 px-2 text-[10px]">
          {getTemplateCategoryLabel(template.category)}
        </Badge>

        {template.isBuiltIn ? (
          <Badge variant="secondary" className="h-5 px-2 text-[10px]">
            Built-in
          </Badge>
        ) : null}

        <span>{words.toLocaleString()} words</span>
        <span>Used {template.usageCount.toLocaleString()}×</span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={onDuplicate}
          disabled={duplicateBusy}
        >
          {duplicateBusy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Copy className="size-3.5" />
          )}
          Duplicate
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              disabled={createDocumentBusy}
            >
              {createDocumentBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileText className="size-3.5" />
              )}
              Use Template
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create a document from this template?</AlertDialogTitle>
              <AlertDialogDescription>
                This creates a separate document using the current template
                content. The template itself will stay in the library.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onCreateDocument}>
                Create Document
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {onDelete ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-destructive hover:text-destructive"
                disabled={deleteBusy}
              >
                {deleteBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete template?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the template from your workspace. Existing
                  documents created from it will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  )
}
