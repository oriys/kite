'use client'

import { UserMenu } from '@/components/auth/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

export function DocsHeaderUtilities({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ThemeToggle />
      <UserMenu />
    </div>
  )
}
