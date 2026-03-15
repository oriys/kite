'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BrainCircuit, KeyRound, Palette, PencilLine, SlidersHorizontal, Users, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

const SETTINGS_NAV = [
  {
    heading: 'Personal',
    items: [
      {
        href: '/docs/settings/personal',
        label: 'Personal',
        icon: SlidersHorizontal,
      },
      {
        href: '/docs/settings/appearance',
        label: 'Appearance',
        icon: Palette,
      },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { href: '/docs/settings/members', label: 'Members', icon: Users },
      { href: '/docs/settings/teams', label: 'Teams', icon: UsersRound },
      { href: '/docs/settings/ai', label: 'AI Models', icon: BrainCircuit },
      { href: '/docs/settings/ai-prompts', label: 'AI Prompts', icon: PencilLine },
      { href: '/docs/settings/notifications', label: 'Notifications', icon: Bell },
      { href: '/docs/settings/sso', label: 'SSO', icon: KeyRound },
    ],
  },
] as const

export function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-48 shrink-0">
      <div className="flex flex-col gap-6">
        {SETTINGS_NAV.map((section) => (
          <div key={section.heading} className="flex flex-col gap-2">
            <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.heading}
            </h2>
            <ul className="flex flex-col gap-1">
              {section.items.map(({ href, label, icon: Icon }) => {
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
                      <Icon className="size-4" />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
