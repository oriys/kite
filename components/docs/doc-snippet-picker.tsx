'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  BookOpenText,
  Braces,
  Clock3,
  Command as CommandIcon,
  FileCode2,
  FileJson,
  GitBranch,
  LayoutTemplate,
  Library,
  MessageSquareQuote,
  Route,
  ShieldCheck,
  Table2,
  Webhook,
  Image as ImageIcon,
} from 'lucide-react'

import {
  DOC_SNIPPET_CATEGORIES,
  type DocSnippet,
  getDocSnippetSearchValue,
} from '@/lib/doc-snippets'
import { useDocSnippets } from '@/hooks/use-doc-snippets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const snippetIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'section-intro': LayoutTemplate,
  'release-notes': BookOpenText,
  'executive-summary': BookOpenText,
  'decision-record': GitBranch,
  'rollout-plan': Clock3,
  'status-snapshot': LayoutTemplate,
  'launch-checklist': Library,
  'incident-timeline': Clock3,
  'callout-note': MessageSquareQuote,
  'implementation-steps': BookOpenText,
  faq: MessageSquareQuote,
  'meeting-notes': BookOpenText,
  'review-checklist': ShieldCheck,
  'migration-guide': GitBranch,
  troubleshooting: AlertCircle,
  'best-practices': Library,
  glossary: Library,
  'comparison-table': Table2,
  'code-example': FileCode2,
  'terminal-command': CommandIcon,
  'sql-query': FileCode2,
  'json-payload': FileJson,
  'image-figure': ImageIcon,
  'metrics-table': Table2,
  heatmap: Table2,
  'file-tree': LayoutTemplate,
  'yaml-config': FileCode2,
  'environment-variables': Table2,
  'test-matrix': Table2,
  'api-endpoint': Route,
  'http-request': Route,
  authentication: ShieldCheck,
  'error-response': AlertCircle,
  'rate-limits': Clock3,
  pagination: Route,
  'schema-field-table': Table2,
  'webhook-retry-policy': Webhook,
  'webhook-event': Webhook,
  'graphql-operation': Braces,
}

interface DocSnippetPickerProps {
  open: boolean
  disabled?: boolean
  onBeforeOpen?: () => void
  onOpenChange: (open: boolean) => void
  onSelect: (snippet: DocSnippet) => void
}

export function DocSnippetPicker({
  open,
  disabled,
  onBeforeOpen,
  onOpenChange,
  onSelect,
}: DocSnippetPickerProps) {
  const { items, refresh } = useDocSnippets()

  React.useEffect(() => {
    if (open) {
      void refresh()
    }
  }, [open, refresh])

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onMouseDown={() => {
            if (!open) {
              onBeforeOpen?.()
            }
          }}
          aria-label="Insert component block"
          className="h-8 gap-2 px-2.5 text-xs"
        >
          Insert
          <span className="text-[10px] tracking-[0.12em] text-muted-foreground">⌘/</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] rounded-xl p-0">
        <Command className="rounded-xl border-0">
          <CommandInput
            autoFocus
            placeholder="Search blocks, snippets, or components…"
          />
          <CommandList className="max-h-[24rem]">
            <CommandEmpty>No matching blocks.</CommandEmpty>
            {DOC_SNIPPET_CATEGORIES.map((category) => {
              const categoryItems = items.filter((snippet) => snippet.category === category)

              if (categoryItems.length === 0) {
                return null
              }

              return (
                <CommandGroup
                  key={category}
                  heading={category}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em]"
                >
                  {categoryItems.map((snippet) => {
                    const Icon = snippetIcons[snippet.id] ?? LayoutTemplate

                    return (
                      <CommandItem
                        key={snippet.id}
                        value={getDocSnippetSearchValue(snippet)}
                        onSelect={() => {
                          onSelect(snippet)
                          onOpenChange(false)
                        }}
                        className="items-start gap-2.5 rounded-lg px-2 py-1.5"
                      >
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/55 bg-muted/20 text-muted-foreground">
                          <Icon className="size-3.5 text-muted-foreground" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {snippet.label}
                            </span>
                            <Badge
                              variant="outline"
                              className="h-5 rounded-md px-1.5 py-0 text-[10px] uppercase tracking-[0.16em]"
                            >
                              {snippet.category}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                            {snippet.description}
                          </p>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/15 px-3 py-2 text-[10px] text-muted-foreground">
          <p>
            Use the Insert button or press <span className="font-medium text-foreground">⌘/</span>{' '}
            to open this picker.
          </p>
          <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-[10px]">
            <Link href="/docs/components">Manage</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
