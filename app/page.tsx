'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  React.useEffect(() => {
    router.replace('/docs')
  }, [router])

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Redirecting to documents...
      </h1>
      <p className="text-sm text-muted-foreground">
        If the redirect does not happen automatically, open the documents workspace.
      </p>
      <Link
        href="/docs"
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Open Documents
      </Link>
    </main>
  )
}
