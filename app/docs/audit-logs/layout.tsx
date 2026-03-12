import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audit Logs — Kite',
  description: 'View activity history and audit trail for your workspace.',
}

export default function AuditLogsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
