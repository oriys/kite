'use client'

import * as React from 'react'
import { ArrowLeftRight, Columns2, Eye, GitCompareArrows, Globe, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type CompareMode, type TranslationLink } from '@/hooks/use-doc-compare'
import { type DocVersion } from '@/lib/documents'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type CompareViewMode = 'diff' | 'preview'

interface DocCompareToolbarProps {
  mode: CompareMode
  onModeChange: (mode: CompareMode) => void

  baseDocuments: { id: string; title: string }[]
  baseDocId: string | null
  onBaseDocChange: (id: string | null) => void

  // Version mode
  versions: DocVersion[]
  leftVersionId: string | null
  onLeftVersionChange: (id: string | null) => void
  rightVersionId: string | null
  onRightVersionChange: (id: string | null) => void

  // Locale mode
  currentLocale: string
  translations: TranslationLink[]
  rightLocaleDocId: string | null
  onRightLocaleChange: (docId: string | null) => void

  // Document mode
  documents: { id: string; title: string }[]
  leftDocId: string | null
  onLeftDocChange: (id: string | null) => void
  rightDocId: string | null
  onRightDocChange: (id: string | null) => void

  // View mode
  viewMode: CompareViewMode
  onViewModeChange: (mode: CompareViewMode) => void

  // Swap
  onSwap: () => void
  className?: string
}

const CURRENT_VERSION_VALUE = '__current__'

const modes: { value: CompareMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'version', label: 'Versions', icon: History },
  { value: 'locale', label: 'Languages', icon: Globe },
  { value: 'document', label: 'Documents', icon: Columns2 },
]

export function DocCompareToolbar({
  mode,
  onModeChange,
  baseDocuments,
  baseDocId,
  onBaseDocChange,
  versions,
  leftVersionId,
  onLeftVersionChange,
  rightVersionId,
  onRightVersionChange,
  currentLocale,
  translations,
  rightLocaleDocId,
  onRightLocaleChange,
  documents,
  leftDocId,
  onLeftDocChange,
  rightDocId,
  onRightDocChange,
  viewMode,
  onViewModeChange,
  onSwap,
  className,
}: DocCompareToolbarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* Mode selector */}
      <div className="flex items-center rounded-md border border-border/70 bg-muted/50 p-0.5">
        {modes.map((m) => {
          const Icon = m.icon
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onModeChange(m.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors',
                mode === m.value
                  ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)] border border-border/80'
                  : 'text-muted-foreground hover:text-foreground border border-transparent',
              )}
            >
              <Icon className="size-3.5" />
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Mode-specific selectors */}
      {mode === 'version' && (
        <VersionSelectors
          baseDocuments={baseDocuments}
          baseDocId={baseDocId}
          onBaseDocChange={onBaseDocChange}
          versions={versions}
          leftVersionId={leftVersionId}
          onLeftVersionChange={onLeftVersionChange}
          rightVersionId={rightVersionId}
          onRightVersionChange={onRightVersionChange}
        />
      )}

      {mode === 'locale' && (
        <LocaleSelectors
          baseDocuments={baseDocuments}
          baseDocId={baseDocId}
          onBaseDocChange={onBaseDocChange}
          currentLocale={currentLocale}
          translations={translations}
          rightLocaleDocId={rightLocaleDocId}
          onRightLocaleChange={onRightLocaleChange}
        />
      )}

      {mode === 'document' && (
        <DocumentSelectors
          documents={documents}
          leftDocId={leftDocId}
          onLeftDocChange={onLeftDocChange}
          rightDocId={rightDocId}
          onRightDocChange={onRightDocChange}
        />
      )}

      {/* Swap button */}
      {mode !== 'locale' && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onSwap}
          aria-label="Swap sides"
        >
          <ArrowLeftRight className="size-3.5" />
        </Button>
      )}

      {/* View mode toggle */}
      <div className="ml-auto flex items-center rounded-md border border-border/70 bg-muted/50 p-0.5">
        <button
          type="button"
          onClick={() => onViewModeChange('diff')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors',
            viewMode === 'diff'
              ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)] border border-border/80'
              : 'text-muted-foreground hover:text-foreground border border-transparent',
          )}
        >
          <GitCompareArrows className="size-3.5" />
          Text Diff
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('preview')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors',
            viewMode === 'preview'
              ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)] border border-border/80'
              : 'text-muted-foreground hover:text-foreground border border-transparent',
          )}
        >
          <Eye className="size-3.5" />
          Preview
        </button>
      </div>
    </div>
  )
}

function VersionSelectors({
  baseDocuments,
  baseDocId,
  onBaseDocChange,
  versions,
  leftVersionId,
  onLeftVersionChange,
  rightVersionId,
  onRightVersionChange,
}: {
  baseDocuments: { id: string; title: string }[]
  baseDocId: string | null
  onBaseDocChange: (id: string | null) => void
  versions: DocVersion[]
  leftVersionId: string | null
  onLeftVersionChange: (id: string | null) => void
  rightVersionId: string | null
  onRightVersionChange: (id: string | null) => void
}) {
  return (
    <>
      <DocumentSelect
        value={baseDocId}
        documents={baseDocuments}
        placeholder="Select document"
        onChange={onBaseDocChange}
      />

      <span className="text-xs text-muted-foreground">then</span>

      <Select
        value={leftVersionId ?? CURRENT_VERSION_VALUE}
        onValueChange={(v) => onLeftVersionChange(v === CURRENT_VERSION_VALUE ? null : v)}
      >
        <SelectTrigger className="h-8 w-auto min-w-[160px] gap-2 text-xs">
          <SelectValue placeholder="Left version" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CURRENT_VERSION_VALUE}>Current version</SelectItem>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {formatVersionDate(v.savedAt)} · {v.wordCount}w
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground">vs</span>

      <Select
        value={rightVersionId ?? CURRENT_VERSION_VALUE}
        onValueChange={(v) => onRightVersionChange(v === CURRENT_VERSION_VALUE ? null : v)}
      >
        <SelectTrigger className="h-8 w-auto min-w-[160px] gap-2 text-xs">
          <SelectValue placeholder="Right version" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CURRENT_VERSION_VALUE}>Current version</SelectItem>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {formatVersionDate(v.savedAt)} · {v.wordCount}w
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

function LocaleSelectors({
  baseDocuments,
  baseDocId,
  onBaseDocChange,
  currentLocale,
  translations,
  rightLocaleDocId,
  onRightLocaleChange,
}: {
  baseDocuments: { id: string; title: string }[]
  baseDocId: string | null
  onBaseDocChange: (id: string | null) => void
  currentLocale: string
  translations: TranslationLink[]
  rightLocaleDocId: string | null
  onRightLocaleChange: (docId: string | null) => void
}) {
  return (
    <>
      <DocumentSelect
        value={baseDocId}
        documents={baseDocuments}
        placeholder="Select document"
        onChange={onBaseDocChange}
      />

      <div className="inline-flex h-8 items-center rounded-md border border-border/70 bg-muted/40 px-3 text-xs font-medium">
        <Globe className="mr-1.5 size-3.5 text-muted-foreground" />
        {currentLocale}
      </div>

      <span className="text-xs text-muted-foreground">vs</span>

      <Select
        value={rightLocaleDocId ?? ''}
        onValueChange={(v) => onRightLocaleChange(v || null)}
      >
        <SelectTrigger className="h-8 w-auto min-w-[160px] gap-2 text-xs">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {translations.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No translations available</div>
          ) : (
            translations.map((t) => (
              <SelectItem key={t.documentId} value={t.documentId}>
                {t.locale} — {t.documentTitle}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </>
  )
}

function DocumentSelect({
  value,
  documents,
  placeholder,
  onChange,
}: {
  value: string | null
  documents: { id: string; title: string }[]
  placeholder: string
  onChange: (id: string | null) => void
}) {
  return (
    <Select value={value ?? ''} onValueChange={(v) => onChange(v || null)}>
      <SelectTrigger className="h-8 w-auto min-w-[220px] gap-2 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {documents.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.title || 'Untitled'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DocumentSelectors({
  documents,
  leftDocId,
  onLeftDocChange,
  rightDocId,
  onRightDocChange,
}: {
  documents: { id: string; title: string }[]
  leftDocId: string | null
  onLeftDocChange: (id: string | null) => void
  rightDocId: string | null
  onRightDocChange: (id: string | null) => void
}) {
  return (
    <>
      <Select
        value={leftDocId ?? ''}
        onValueChange={(v) => onLeftDocChange(v || null)}
      >
        <SelectTrigger className="h-8 w-auto min-w-[180px] gap-2 text-xs">
          <SelectValue placeholder="Left document" />
        </SelectTrigger>
        <SelectContent>
          {documents.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.title || 'Untitled'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground">vs</span>

      <Select
        value={rightDocId ?? ''}
        onValueChange={(v) => onRightDocChange(v || null)}
      >
        <SelectTrigger className="h-8 w-auto min-w-[180px] gap-2 text-xs">
          <SelectValue placeholder="Right document" />
        </SelectTrigger>
        <SelectContent>
          {documents.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.title || 'Untitled'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

function formatVersionDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
