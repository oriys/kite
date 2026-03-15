import { auth, signIn } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USERS } from '@/lib/dev-mock-auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SsoSignInSection } from '@/components/auth/sso-signin-section'

function isSafeCallbackUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

function ssoErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    sso_not_configured: 'SSO is not configured for this workspace.',
    sso_misconfigured: 'SSO is misconfigured. Contact your workspace admin.',
    sso_token_exchange_failed: 'Failed to authenticate with the identity provider.',
    sso_userinfo_failed: 'Failed to retrieve user information from the identity provider.',
    sso_no_access_token: 'Identity provider did not return an access token.',
    sso_no_identifier: 'Identity provider did not return an email or user ID.',
    sso_user_creation_failed: 'Failed to create user account.',
    sso_invalid_state: 'Invalid SSO state. Please try again.',
    sso_no_code: 'No authorization code received.',
    sso_server_error: 'Server configuration error. Contact your administrator.',
    missing_workspace: 'Please enter a workspace slug to use SSO.',
  }
  return messages[code] ?? 'SSO authentication failed. Please try again.'
}

export default async function SignInPage(props: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const session = await auth()
  if (session) redirect('/docs')

  const { callbackUrl, error } = await props.searchParams
  const safeCallback = callbackUrl && isSafeCallbackUrl(callbackUrl) ? callbackUrl : '/docs'

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <p className="mb-3 text-2xl font-semibold tracking-tight text-foreground">
            Kite
          </p>
          <CardTitle className="text-lg font-semibold tracking-tight">
            Sign in
          </CardTitle>
          <CardDescription>
            API documentation, edited with care.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error === 'OAuthAccountNotLinked'
                ? 'This email is already linked to another provider.'
                : error.startsWith('sso_')
                  ? ssoErrorMessage(error)
                  : 'Something went wrong. Please try again.'}
            </p>
          )}
          {DEV_MOCK_AUTH_ENABLED ? (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="mb-2">
                <p className="text-sm font-medium text-foreground">
                  Local development accounts
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use these mock users to test members, teams, and approval flows.
                </p>
              </div>
              <div className="grid gap-2">
                {DEV_MOCK_USERS.map((user) => (
                  <form
                    key={user.id}
                    action={async () => {
                      'use server'
                      await signIn('dev-mock', {
                        mockUserId: user.id,
                        redirectTo: safeCallback,
                      })
                    }}
                  >
                    <Button
                      variant="outline"
                      className="flex h-auto w-full items-center justify-between px-3 py-2 text-left"
                      type="submit"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                      <span className="ml-3 shrink-0 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {user.role}
                      </span>
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
          <form
            action={async () => {
              'use server'
              await signIn('github', { redirectTo: safeCallback })
            }}
          >
            <Button variant="outline" className="w-full" type="submit">
              <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Continue with GitHub
            </Button>
          </form>
          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: safeCallback })
            }}
          >
            <Button variant="outline" className="w-full" type="submit">
              <svg className="mr-2 size-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>
          </form>
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          <SsoSignInSection />
        </CardContent>
      </Card>
    </div>
  )
}
