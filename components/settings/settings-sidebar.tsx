'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const SETTINGS_NAV = [
  { href: '/docs/settings/members', label: 'Members', icon: Users },
  { href: '/docs/settings/teams', label: 'Teams', icon: UsersRound },
]

export function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-48 shrink-0">
      <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Settings
      </h2>
      <ul className="space-y-0.5">
        {SETTINGS_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent/50 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
