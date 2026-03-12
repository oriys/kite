import type { Metadata } from 'next'

import { DocsTopNav } from '@/components/docs/docs-top-nav'

export const metadata: Metadata = {
  title: 'Documents — Kite',
  description: 'Create, edit, review, and publish documents.',
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <DocsTopNav />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
