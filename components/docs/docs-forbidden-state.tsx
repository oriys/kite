'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface DocsForbiddenStateProps {
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
}

export function DocsForbiddenState({
  title = 'You do not have access to this area.',
  description = 'Your account is signed in, but this workspace area is limited to a higher role. Ask a workspace admin or owner if you should be granted access.',
  backHref = '/docs',
  backLabel = 'Back to Documents',
}: DocsForbiddenStateProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-5xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-6 rounded-[1.5rem] border border-border/60 bg-background/95 p-6 shadow-[0_1px_1px_rgba(15,23,42,0.04),0_18px_40px_rgba(15,23,42,0.06)] md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] md:p-8">
        <div className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            HTTP 403
          </div>

          <div className="space-y-3">
            <h1 className="text-pretty text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              {description}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.125rem] border border-border/60 bg-card/90 p-5 shadow-[0_1px_1px_rgba(15,23,42,0.04)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />

          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            What you can do next
          </p>

          <div className="mt-4 space-y-3 text-sm leading-6 text-foreground/85">
            <p>Return to a section you already can access.</p>
            <p>Ask an admin or owner to review your workspace role or document permissions.</p>
            <p>Use the document list to keep working somewhere else.</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
