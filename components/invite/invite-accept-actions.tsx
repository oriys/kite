'use client'

import * as React from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Loader2, LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface InviteAcceptActionsProps {
  token: string
  callbackPath: string
  invitedEmail?: string | null
  signedInEmail?: string | null
}

export function InviteAcceptActions({
  token,
  callbackPath,
  invitedEmail,
  signedInEmail,
}: InviteAcceptActionsProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isAccepted, setIsAccepted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const signInPath = `/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`
  const emailMismatch =
    !!invitedEmail &&
    !!signedInEmail &&
    invitedEmail.toLowerCase() !== signedInEmail.toLowerCase()

  async function handleAccept() {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      if (response.status === 401) {
        window.location.href = signInPath
        return
      }

      const isJsonResponse = response.headers
        .get('content-type')
        ?.includes('application/json')
      const data = isJsonResponse
        ? ((await response.json()) as { error?: string } | null)
        : null
      if (!response.ok) {
        throw new Error(data?.error ?? 'Failed to accept invite')
      }

      setIsAccepted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAccepted) {
    return (
      <div className="grid gap-3">
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Invitation accepted. You can now continue into Kite.
        </p>
        <Button asChild className="w-full">
          <Link href="/docs">Open docs</Link>
        </Button>
      </div>
    )
  }

  if (emailMismatch) {
    return (
      <div className="grid gap-3">
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This invite is for <span className="font-medium">{invitedEmail}</span>, but you are signed in as{' '}
          <span className="font-medium">{signedInEmail}</span>.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => signOut({ callbackUrl: signInPath })}
        >
          <LogOut className="size-4" />
          Sign out and switch account
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="w-full"
        onClick={handleAccept}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Accepting invitation…
          </>
        ) : (
          'Accept invitation'
        )}
      </Button>
    </div>
  )
}
