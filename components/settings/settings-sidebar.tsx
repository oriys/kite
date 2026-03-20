'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Bell, Blocks, BookOpen, BrainCircuit, Bug, Cable, Key, KeyRound, Palette, PencilLine, Plug, Shield, SlidersHorizontal, Users, UsersRound, Webhook } from 'lucide-react'

import { useSettingsAccess, type SettingsRole } from '@/components/settings/settings-access-provider'
import { cn } from '@/lib/utils'

const ROLE_LEVELS: Record<SettingsRole, number> = {
  guest: 0,
  member: 1,
  admin: 2,
  owner: 3,
}

function hasMinimumRole(actual: SettingsRole, required: SettingsRole) {
  return ROLE_LEVELS[actual] >= ROLE_LEVELS[required]
}

const SETTINGS_NAV = [
  {
    heading: 'Personal',
    items: [
      {
        href: '/docs/settings/personal',
        label: 'Personal',
        icon: SlidersHorizontal,
        minRole: 'guest',
      },
      {
        href: '/docs/settings/appearance',
        label: 'Appearance',
        icon: Palette,
        minRole: 'guest',
      },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { href: '/docs/settings/members', label: 'Members', icon: Users, minRole: 'guest' },
      { href: '/docs/settings/teams', label: 'Teams', icon: UsersRound, minRole: 'guest' },
      { href: '/docs/settings/ai', label: 'AI Models', icon: BrainCircuit, minRole: 'member' },
      {
        href: '/docs/settings/ai-prompts',
        label: 'AI Prompts',
        icon: PencilLine,
        minRole: 'member',
      },
      { href: '/docs/settings/mcp', label: 'MCP Servers', icon: Cable, minRole: 'admin' },
      {
        href: '/docs/settings/knowledge-base',
        label: 'Knowledge Base',
        icon: BookOpen,
        minRole: 'admin',
      },
      {
        href: '/docs/settings/rag-diagnostics',
        label: 'RAG Diagnostics',
        icon: Activity,
        minRole: 'owner',
      },
      {
        href: '/docs/settings/notifications',
        label: 'Notifications',
        icon: Bell,
        minRole: 'admin',
      },
      {
        href: '/docs/settings/integrations',
        label: 'Integrations',
        icon: Plug,
        minRole: 'admin',
      },
      {
        href: '/docs/settings/webhooks',
        label: 'Webhooks',
        icon: Webhook,
        minRole: 'admin',
      },
      {
        href: '/docs/settings/branding',
        label: 'Branding',
        icon: Palette,
        minRole: 'admin',
      },
      {
        href: '/docs/settings/quick-insert',
        label: 'Quick Insert',
        icon: Blocks,
        minRole: 'member',
      },
      {
        href: '/docs/settings/audit-logs',
        label: 'Audit Logs',
        icon: Shield,
        minRole: 'admin',
      },
      {
        href: '/docs/settings/error-reports',
        label: 'Error Reports',
        icon: Bug,
        minRole: 'admin',
      },
      { href: '/docs/settings/tokens', label: 'API Tokens', icon: Key, minRole: 'member' },
      { href: '/docs/settings/sso', label: 'SSO', icon: KeyRound, minRole: 'admin' },
    ],
  },
] as const

export function SettingsSidebar() {
  const pathname = usePathname()
  const { currentRole } = useSettingsAccess()

  return (
    <nav className="w-48 shrink-0">
      <div className="flex flex-col gap-6">
        {SETTINGS_NAV.map((section) => {
          const visibleItems = section.items.filter(({ minRole }) =>
            hasMinimumRole(currentRole, minRole),
          )

          if (visibleItems.length === 0) {
            return null
          }

          return (
            <div key={section.heading} className="flex flex-col gap-2">
              <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.heading}
              </h2>
              <ul className="flex flex-col gap-1">
                {visibleItems.map(({ href, label, icon: Icon }) => {
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
          )
        })}
      </div>
    </nav>
  )
}
