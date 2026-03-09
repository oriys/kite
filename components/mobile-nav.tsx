'use client'

import * as React from 'react'
import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

interface MobileNavProps {
  sections: ReadonlyArray<{ id: string; label: string; note: string }>
}

export function MobileNav({ sections }: MobileNavProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="text-sm font-medium">Page map</SheetTitle>
        </SheetHeader>
        <Separator />
        <nav className="space-y-1 p-3">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={() => setOpen(false)}
              className="editorial-sidebar-link"
            >
              <span>{section.label}</span>
              <span className="text-xs text-muted-foreground/80">
                {section.note}
              </span>
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
