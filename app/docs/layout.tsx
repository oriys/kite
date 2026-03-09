import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documents — Editorial System',
  description: 'Create, edit, review, and publish documents.',
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-background">
      {children}
    </div>
  )
}
