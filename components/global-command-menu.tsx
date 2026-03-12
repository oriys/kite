'use client'

import * as React from 'react'
import {
  Calculator,
  FileText,
  Columns,
  Code,
  Type,
  Table,
  Eye,
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

interface GlobalCommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (action: string) => void
}

export function GlobalCommandMenu({ open, onOpenChange, onAction }: GlobalCommandMenuProps) {
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [onOpenChange, open])

  const run = (action: string) => {
    onAction(action)
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="General">
          <CommandItem onSelect={() => run('show-shortcuts')}>
            <Calculator className="mr-2 h-4 w-4" />
            <span>Keyboard Shortcuts</span>
            <CommandShortcut>⌘/</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Editor View">
          <CommandItem onSelect={() => run('view-wysiwyg')}>
            <Eye className="mr-2 h-4 w-4" />
            <span>Visual Editor</span>
            <CommandShortcut>Alt 1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run('view-source')}>
            <Code className="mr-2 h-4 w-4" />
            <span>Source Code</span>
            <CommandShortcut>Alt 2</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run('view-split')}>
            <Columns className="mr-2 h-4 w-4" />
            <span>Split View</span>
            <CommandShortcut>Alt 3</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Insert">
          <CommandItem onSelect={() => run('insert-table')}>
            <Table className="mr-2 h-4 w-4" />
            <span>Table</span>
          </CommandItem>
          <CommandItem onSelect={() => run('insert-code-block')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Code Block</span>
            <CommandShortcut>⌘⇧C</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Formatting">
          <CommandItem onSelect={() => run('format-bold')}>
            <Type className="mr-2 h-4 w-4" />
            <span>Bold</span>
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run('format-italic')}>
            <Type className="mr-2 h-4 w-4" />
            <span>Italic</span>
            <CommandShortcut>⌘I</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
