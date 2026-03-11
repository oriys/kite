'use client'

import * as React from 'react'
import {
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table,
  Type,
} from 'lucide-react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'

interface SlashMenuProps {
  editorRef: React.RefObject<HTMLDivElement | null>
  onSelect: (action: string) => void
  onClose: () => void
}

interface SlashCommandItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  hint: string
  commitKey: 'Enter' | 'Tab'
  keywords: string[]
}

const COMMANDS: Array<{ group: string; items: SlashCommandItem[] }> = [
  {
    group: 'Basic',
    items: [
      {
        id: 'text',
        label: 'Text',
        icon: Type,
        description: 'Continue with plain text',
        hint: '/text',
        commitKey: 'Enter',
        keywords: ['text', 'paragraph', 'body', '/text'],
      },
      {
        id: 'h1',
        label: 'Heading 1',
        icon: Heading1,
        description: 'Create a large section heading',
        hint: '/h1',
        commitKey: 'Enter',
        keywords: ['heading 1', 'title', 'h1', '/h1'],
      },
      {
        id: 'h2',
        label: 'Heading 2',
        icon: Heading2,
        description: 'Create a medium section heading',
        hint: '/h2',
        commitKey: 'Enter',
        keywords: ['heading 2', 'subtitle', 'h2', '/h2'],
      },
      {
        id: 'h3',
        label: 'Heading 3',
        icon: Heading3,
        description: 'Create a compact section heading',
        hint: '/h3',
        commitKey: 'Enter',
        keywords: ['heading 3', 'subheading', 'h3', '/h3'],
      },
    ],
  },
  {
    group: 'Lists',
    items: [
      {
        id: 'ul',
        label: 'Bullet List',
        icon: List,
        description: 'Start a simple bulleted list',
        hint: '/ul',
        commitKey: 'Tab',
        keywords: ['list', 'bullet', 'unordered', 'ul', '/ul'],
      },
      {
        id: 'ol',
        label: 'Numbered List',
        icon: ListOrdered,
        description: 'Start a numbered sequence',
        hint: '/ol',
        commitKey: 'Tab',
        keywords: ['list', 'numbered', 'ordered', 'ol', '/ol'],
      },
      {
        id: 'blockquote',
        label: 'Quote',
        icon: Quote,
        description: 'Call out a quote or note',
        hint: '/quote',
        commitKey: 'Enter',
        keywords: ['quote', 'blockquote', 'callout', '/quote'],
      },
    ],
  },
  {
    group: 'Media & Advanced',
    items: [
      {
        id: 'table',
        label: 'Table',
        icon: Table,
        description: 'Insert a 3×3 editable table',
        hint: '/table',
        commitKey: 'Enter',
        keywords: ['table', 'grid', 'columns', '/table'],
      },
      {
        id: 'heatmap',
        label: 'Heatmap',
        icon: Table,
        description: 'Insert an editable heatmap block',
        hint: '/heatmap',
        commitKey: 'Enter',
        keywords: ['heatmap', 'matrix', 'score grid', '/heatmap'],
      },
      {
        id: 'code',
        label: 'Code Block',
        icon: FileCode,
        description: 'Insert a fenced code block',
        hint: '/code',
        commitKey: 'Tab',
        keywords: ['code', 'snippet', 'fence', '/code'],
      },
      {
        id: 'divider',
        label: 'Divider',
        icon: Minus,
        description: 'Separate sections with a rule',
        hint: '/divider',
        commitKey: 'Enter',
        keywords: ['divider', 'rule', 'separator', '/divider'],
      },
    ],
  },
]

export const DocSlashMenu = React.forwardRef<
  { show: () => void; hide: () => void },
  SlashMenuProps
>(({ editorRef, onSelect, onClose }, ref) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)
  const [isVisible, setIsVisible] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const menuRef = React.useRef<HTMLDivElement>(null)

  const updatePosition = React.useCallback(() => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) {
      setIsVisible(false)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const parent = editorRef.current.parentElement
    if (!parent) return

    const parentRect = parent.getBoundingClientRect()

    setPosition({
      top: rect.bottom - parentRect.top + 8,
      left: rect.left - parentRect.left,
    })
    setIsVisible(true)
  }, [editorRef])

  const hideMenu = React.useCallback(() => {
    setIsVisible(false)
    setQuery('')
  }, [])

  React.useImperativeHandle(ref, () => ({
    show: () => {
      setIsVisible(true)
      setQuery('')
      setTimeout(updatePosition, 10)
    },
    hide: hideMenu,
  }))

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isVisible && !(e.target as Element).closest('[data-slash-menu]')) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isVisible, onClose])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) {
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key !== 'Tab') {
        return
      }

      const selectedItem = menuRef.current?.querySelector<HTMLElement>(
        '[data-slot="command-item"][data-selected="true"]',
      )

      if (!selectedItem) {
        return
      }

      e.preventDefault()
      e.stopPropagation()
      selectedItem.click()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, onClose])

  React.useEffect(() => {
    if (!isVisible) {
      setQuery('')
    }
  }, [isVisible])

  if (!isVisible || !position) return null

  const normalizedQuery = query.trim().toLowerCase()

  return (
    <div
      ref={menuRef}
      data-slash-menu
      className="absolute z-50 w-80 overflow-hidden rounded-xl border border-border/80 bg-background/95 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-md animate-in fade-in slide-in-from-top-1"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <Command className="bg-transparent" loop>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search blocks, headings, tables, or /h1"
          autoFocus
        />
        <CommandList className="max-h-[320px]">
          <CommandEmpty className="px-4 py-8 text-left">
            <p className="text-sm font-medium text-foreground">No blocks found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try another keyword, or press Esc to return to the editor.
            </p>
          </CommandEmpty>
          {COMMANDS.map((group) => (
            <CommandGroup key={group.group} heading={group.group}>
              {group.items.map((item) => {
                const isKeywordMatch = normalizedQuery.length > 0 &&
                  item.keywords.some((keyword) => keyword.toLowerCase() === normalizedQuery)

                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.description} ${item.keywords.join(' ')}`}
                    onSelect={() => {
                      onSelect(item.id)
                      onClose()
                    }}
                    className="group flex items-center gap-2.5 rounded-lg py-2.5 transition-[transform,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] data-[selected=true]:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.15)]"
                  >
                    <div
                      className={
                        `flex size-8 items-center justify-center rounded-md border border-border/50 bg-muted/45 text-muted-foreground transition-[transform,border-color,background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[selected=true]:border-accent/70 group-data-[selected=true]:bg-accent/12 group-data-[selected=true]:text-accent-foreground ${isKeywordMatch ? 'scale-[1.04] border-accent/55 bg-accent/10 text-accent-foreground' : ''}`
                      }
                    >
                      <item.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        <span className="rounded-md border border-border/60 bg-muted/35 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {item.hint}
                        </span>
                      </div>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                        {item.description}
                      </span>
                    </div>
                    <CommandShortcut className="text-[10px] tracking-[0.14em]">
                      {item.commitKey}
                    </CommandShortcut>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <span>Enter or Tab inserts the highlighted block.</span>
          <span>Esc closes</span>
        </div>
      </Command>
    </div>
  )
})

DocSlashMenu.displayName = 'DocSlashMenu'
