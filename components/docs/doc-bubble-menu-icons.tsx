export function ShortenActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M2.5 5h3m8 0H10.5M6 3.5 4.5 5 6 6.5M10 9.5 11.5 11 10 12.5M2.5 11h3m8 0H10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ExpandActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 3.5 3.5 5 5 6.5M11 9.5 12.5 11 11 12.5M2.5 5h3m8 0H10.5M2.5 11h3m8 0H10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ExplainActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4.5 4.25h7a1.75 1.75 0 0 1 1.75 1.75v4a1.75 1.75 0 0 1-1.75 1.75H8l-2.75 2v-2H4.5A1.75 1.75 0 0 1 2.75 10V6A1.75 1.75 0 0 1 4.5 4.25Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 6.75h3M6.5 9.25h2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AutoFixActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3.5 4.5h5M3.5 8h3M3.5 11.5h4.5M10.5 3.75l.9 1.8 2 .28-1.45 1.4.34 1.97-1.79-.93-1.79.93.34-1.97-1.45-1.4 2-.28.9-1.8Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DiagramActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <rect
        x="2.5"
        y="3"
        width="4"
        height="3"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="9.5"
        y="3"
        width="4"
        height="3"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="6"
        y="10"
        width="4"
        height="3"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6.5 4.5h3M8 6v4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ManageActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 4.25h6M10.5 4.25h2.5M3 8h2.5M7 8h6M3 11.75h6M10.5 11.75H13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="4.25" r="1.25" fill="currentColor" />
      <circle cx="5.5" cy="8" r="1.25" fill="currentColor" />
      <circle cx="9.5" cy="11.75" r="1.25" fill="currentColor" />
    </svg>
  )
}
