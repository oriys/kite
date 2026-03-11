'use client'

import * as React from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Table,
  FileCode,
  Minus,
  Type,
} from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface SlashMenuProps {
  editorRef: React.RefObject<HTMLDivElement | null>
  onSelect: (action: string) => void
  onClose: () => void
}

const COMMANDS = [
  {
    group: 'Basic',
    items: [
      { id: 'text', label: 'Text', icon: Type, description: 'Start writing plain text' },
      { id: 'h1', label: 'Heading 1', icon: Heading1, description: 'Large section heading' },
      { id: 'h2', label: 'Heading 2', icon: Heading2, description: 'Medium section heading' },
      { id: 'h3', label: 'Heading 3', icon: Heading3, description: 'Small section heading' },
    ],
  },
  {
    group: 'Lists',
    items: [
      { id: 'ul', label: 'Bullet List', icon: List, description: 'Create a simple bulleted list' },
      { id: 'ol', label: 'Numbered List', icon: ListOrdered, description: 'Create a list with numbering' },
      { id: 'blockquote', label: 'Quote', icon: Quote, description: 'Capture a quotation' },
    ],
  },
  {
    group: 'Media & Advanced',
    items: [
      { id: 'table', label: 'Table', icon: Table, description: 'Insert a 3x3 table' },
      { id: 'heatmap', label: 'Heatmap', icon: Table, description: 'Insert an editable heatmap block' },
      { id: 'code', label: 'Code Block', icon: FileCode, description: 'Insert a code snippet' },
      { id: 'divider', label: 'Divider', icon: Minus, description: 'Insert a horizontal rule' },
    ],
  },
]

export const DocSlashMenu = React.forwardRef<
  { show: () => void; hide: () => void },
  SlashMenuProps
>(({ editorRef, onSelect, onClose }, ref) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)
  const [isVisible, setIsVisible] = React.useState(false)

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

  React.useImperativeHandle(ref, () => ({
    show: () => {
      setIsVisible(true)
      // Use a small timeout to ensure the DOM has updated and the caret is in place
      setTimeout(updatePosition, 10)
    },
    hide: () => setIsVisible(false),
  }))

  // Detect click outside to close
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isVisible && !(e.target as Element).closest('[data-slash-menu]')) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isVisible, onClose])

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || e.key !== 'Escape') {
        return
      }

      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, onClose])

  if (!isVisible || !position) return null

  return (
    <div
      data-slash-menu
      className="absolute z-50 w-72 overflow-hidden rounded-lg border border-border/80 bg-background/95 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-1"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <Command className="bg-transparent" loop>
        <CommandInput placeholder="Type / to search..." autoFocus />
        <CommandList className="max-h-[300px]">
          <CommandEmpty>No commands found.</CommandEmpty>
          {COMMANDS.map((group) => (
            <CommandGroup key={group.group} heading={group.group}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => {
                    onSelect(item.id)
                    onClose()
                  }}
                  className="flex items-center gap-2 py-2"
                >
                  <div className="flex size-7 items-center justify-center rounded-md border border-border/50 bg-muted/50 text-muted-foreground group-aria-selected:border-accent group-aria-selected:bg-accent group-aria-selected:text-accent-foreground">
                    <item.icon className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">{item.description}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>
  )
})

DocSlashMenu.displayName = 'DocSlashMenu'
