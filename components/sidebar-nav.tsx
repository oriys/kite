'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { ShieldCheck } from 'lucide-react'

interface SidebarNavProps {
  sections: ReadonlyArray<{ id: string; label: string; note: string }>
}

export function SidebarNav({ sections }: SidebarNavProps) {
  const [activeId, setActiveId] = React.useState<string>(sections[0]?.id ?? '')

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 },
    )

    sections.forEach((section) => {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-6 editorial-surface p-3">
        <p className="editorial-section-kicker mb-3">Page map</p>
        <nav aria-label="Page sections" className="space-y-1">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={activeId === section.id ? 'true' : undefined}
              className={cn(
                'editorial-sidebar-link',
                activeId === section.id &&
                  'bg-accent/50 text-foreground',
              )}
            >
              <span>{section.label}</span>
              <span className="text-xs text-muted-foreground/80">
                {section.note}
              </span>
            </a>
          ))}
        </nav>

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="rounded-lg bg-muted/45 p-3">
            <p className="text-sm font-medium text-foreground">
              Design stance
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Quiet hierarchy, warm neutrals, and just enough cool blue to
              indicate focus, selection, and system intent.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border/75 bg-card/80 px-3 py-2 text-sm">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Ready for docs, admin, and editor workflows.
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
