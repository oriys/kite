import Link from 'next/link'

import { auth } from '@/lib/auth'
import { getInvitePreview } from '@/lib/queries/invites'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { InviteAcceptActions } from '@/components/invite/invite-accept-actions'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const invite = await getInvitePreview(token)
  const session = await auth()
  const callbackPath = `/invite/${token}`

  const isExpired = invite ? invite.expiresAt < new Date() : false
  const isAccepted = !!invite?.acceptedAt

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <p className="mb-3 text-2xl font-semibold tracking-tight text-foreground">
            Kite
          </p>
          <CardTitle className="text-lg font-semibold tracking-tight">
            {invite
              ? isAccepted
                ? 'Invitation already used'
                : isExpired
                  ? 'Invitation expired'
                  : 'Workspace invitation'
              : 'Invitation not found'}
          </CardTitle>
          <CardDescription>
            {invite
              ? `You have been invited to join ${invite.workspaceName}.`
              : 'The invitation link may have been revoked or copied incorrectly.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {invite ? (
            <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{formatRole(invite.role)}</Badge>
                <Badge variant="outline">
                  {invite.type === 'email' ? 'Email invite' : 'Link invite'}
                </Badge>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                  <dt className="text-muted-foreground">Workspace</dt>
                  <dd className="font-medium text-foreground">
                    {invite.workspaceName}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                  <dt className="text-muted-foreground">Invited by</dt>
                  <dd className="font-medium text-foreground">
                    {invite.inviterName || 'Workspace admin'}
                  </dd>
                </div>
                {invite.email ? (
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                    <dt className="text-muted-foreground">Invited email</dt>
                    <dd className="font-medium text-foreground">
                      {invite.email}
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                  <dt className="text-muted-foreground">Expires</dt>
                  <dd className="font-medium text-foreground">
                    {formatTimestamp(invite.expiresAt)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              We could not find an active invitation for this link.
            </p>
          )}

          {!invite ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/signin">Back to sign in</Link>
            </Button>
          ) : isAccepted ? (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              This invitation has already been accepted.
            </p>
          ) : isExpired ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              This invitation has expired. Ask a workspace admin to generate a new link.
            </p>
          ) : session?.user ? (
            <InviteAcceptActions
              token={token}
              callbackPath={callbackPath}
              invitedEmail={invite.email}
              signedInEmail={session.user.email}
            />
          ) : (
            <div className="grid gap-3">
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Sign in to accept this invitation.
              </p>
              <Button asChild className="w-full">
                <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`}>
                  Sign in to continue
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
