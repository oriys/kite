'use client'

import { XtermTerminal } from '@/components/terminal/xterm-terminal'

export default function TerminalPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Terminal
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Interactive shell — each session starts in a fresh temporary
          directory.
        </p>
      </div>

      <div className="flex-1 p-4 sm:p-6">
        <XtermTerminal
          className="flex flex-col overflow-hidden rounded-lg border border-border shadow-sm"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}
