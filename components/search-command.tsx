'use client'

import * as React from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface SearchCommandProps {
  sections: ReadonlyArray<{ id: string; label: string; note: string }>
}

const SearchOpenContext = React.createContext<(() => void) | null>(null)

export function useSearchOpen() {
  return React.useContext(SearchOpenContext)
}

export function SearchCommand({ sections }: SearchCommandProps) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const openSearch = React.useCallback(() => setOpen(true), [])

  return (
    <SearchOpenContext value={openSearch}>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a section…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Sections">
            {sections.map((section) => (
              <CommandItem
                key={section.id}
                value={`${section.label} ${section.note}`}
                onSelect={() => {
                  setOpen(false)
                  const el = document.getElementById(section.id)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                <span className="font-medium">{section.label}</span>
                <span className="ml-2 text-muted-foreground text-xs">{section.note}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SearchOpenContext>
  )
}
