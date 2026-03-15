import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PublicNav } from './public-nav'
import type { PublishedWorkspace, PublishedDocument } from '@/lib/queries/public-docs'

interface NavSection {
  title: string
  docs: PublishedDocument[]
}

interface PublicLayoutProps {
  workspace: PublishedWorkspace
  sections: NavSection[]
  hasApiReference: boolean
  children: React.ReactNode
}

export function PublicLayout({ workspace, sections, hasApiReference, children }: PublicLayoutProps) {
  const branding = workspace.branding
  const brandingStyles: Record<string, string> = {}
  if (branding?.primaryColor) brandingStyles['--pub-primary'] = branding.primaryColor
  if (branding?.accentColor) brandingStyles['--pub-accent'] = branding.accentColor

  return (
    <div className="flex min-h-dvh" style={brandingStyles as React.CSSProperties}>
      <PublicNav
        workspaceSlug={workspace.slug}
        sections={sections}
        hasApiReference={hasApiReference}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-6 backdrop-blur-sm lg:px-8">
          <div className="flex items-center gap-3 pl-10 lg:pl-0">
            {branding?.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt={workspace.name}
                width={28}
                height={28}
                className="size-7 rounded object-contain"
              />
            ) : (
              <div className="flex size-7 items-center justify-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
                {workspace.name.charAt(0).toUpperCase()}
              </div>
            )}
            <Link
              href={`/pub/${workspace.slug}`}
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              {workspace.name}
            </Link>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-6 py-8 lg:px-8">
          <div className="mx-auto max-w-3xl">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t px-6 py-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground/60">
            Powered by {workspace.name}
          </p>
        </footer>
      </div>

      {/* Custom CSS */}
      {branding?.customCss && (
        <style dangerouslySetInnerHTML={{ __html: branding.customCss }} />
      )}
    </div>
  )
}
