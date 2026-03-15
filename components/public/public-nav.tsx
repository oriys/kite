'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Menu, X, FileText, Code } from 'lucide-react'
import type { PublishedDocument } from '@/lib/queries/public-docs'

interface NavSection {
  title: string
  docs: PublishedDocument[]
}

interface PublicNavProps {
  workspaceSlug: string
  sections: NavSection[]
  hasApiReference: boolean
}

export function PublicNav({ workspaceSlug, sections, hasApiReference }: PublicNavProps) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  const basePath = `/pub/${workspaceSlug}`

  const navContent = (
    <nav className="flex flex-col gap-1 py-4">
      <Link
        href={basePath}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          pathname === basePath
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <FileText className="size-4 shrink-0" />
        Overview
      </Link>

      {sections.map((section) => (
        <div key={section.title} className="mt-4">
          <span className="px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {section.title}
          </span>
          <div className="mt-1 flex flex-col gap-0.5">
            {section.docs.map((doc) => {
              const slug = doc.publishedSlug || doc.slug || doc.id
              const href = `${basePath}/${slug}`
              const isActive = pathname === href
              return (
                <Link
                  key={doc.id}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {doc.title}
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      {hasApiReference && (
        <div className="mt-4">
          <span className="px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Reference
          </span>
          <div className="mt-1 flex flex-col gap-0.5">
            <Link
              href={`${basePath}/api-reference`}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                pathname === `${basePath}/api-reference`
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Code className="size-4 shrink-0" />
              API Reference
            </Link>
          </div>
        </div>
      )}
    </nav>
  )

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-50 rounded-md border bg-background p-2 shadow-sm lg:hidden"
        aria-label="Toggle navigation"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-dvh w-[260px] shrink-0 border-r bg-background/95 backdrop-blur-sm transition-transform duration-200 lg:sticky lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col overflow-y-auto px-2">
          {navContent}
        </div>
      </aside>
    </>
  )
}
