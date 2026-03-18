import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

type KiteLogoProps = ComponentProps<'span'> & {
  showWordmark?: boolean
  markClassName?: string
  wordmarkClassName?: string
}

export function KiteMark({
  className,
  ...props
}: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5 shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M33.5 7.5L52.5 24.5L33.5 41.5L14.5 24.5L33.5 7.5Z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M33.5 7.5L52.5 24.5L33.5 41.5L14.5 24.5L33.5 7.5Z"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinejoin="round"
      />
      <path
        d="M33.5 7.5V41.5"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
      />
      <path
        d="M14.5 24.5H52.5"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M33.5 41.5C29.6 46.1 26.1 49.5 21.6 51.6C18 53.3 15 55.9 13.2 59.2"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="60" r="2.25" fill="currentColor" />
    </svg>
  )
}

export function KiteLogo({
  className,
  showWordmark = true,
  markClassName,
  wordmarkClassName,
  ...props
}: KiteLogoProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-foreground',
        className,
      )}
      {...props}
    >
      <KiteMark className={markClassName} />
      {showWordmark ? (
        <span
          className={cn(
            'text-sm font-semibold tracking-[-0.04em] text-foreground',
            wordmarkClassName,
          )}
        >
          Kite
        </span>
      ) : null}
    </span>
  )
}
