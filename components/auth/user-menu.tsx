'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { LogOut, SlidersHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function UserMenu() {
  const { data: session } = useSession()
  if (!session?.user) return null

  const { name, email, image } = session.user
  const initials = (name ?? email ?? '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'icon' }),
            'rounded-md p-0',
          )}
          aria-label={name ? `${name} account menu` : 'Account menu'}
        >
          <Avatar className="size-7">
          {image && <AvatarImage src={image} alt={name ?? ''} />}
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium leading-none">{name}</p>
          {email && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {email}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/docs/settings/personal">
            <SlidersHorizontal className="mr-2 size-3.5" />
            Personal settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
          <LogOut className="mr-2 size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
