import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, accounts, workspaceMembers, ssoConfigs } from '@/lib/schema'
import { encode } from 'next-auth/jwt'

interface SsoState {
  workspaceId: string
  configId: string
}

function parseState(raw: string | null): SsoState | null {
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString())
  } catch {
    return null
  }
}

function signinError(request: NextRequest, error: string) {
  return NextResponse.redirect(
    new URL(`/auth/signin?error=${encodeURIComponent(error)}`, request.url),
  )
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const stateRaw = request.nextUrl.searchParams.get('state')
  const errorParam = request.nextUrl.searchParams.get('error')

  if (errorParam) {
    return signinError(request, `sso_provider_error: ${errorParam}`)
  }

  if (!code) {
    return signinError(request, 'sso_no_code')
  }

  const state = parseState(stateRaw)
  if (!state) {
    return signinError(request, 'sso_invalid_state')
  }

  const config = await db.query.ssoConfigs.findFirst({
    where: eq(ssoConfigs.id, state.configId),
  })

  if (!config?.issuerUrl || !config.clientId || !config.clientSecret) {
    return signinError(request, 'sso_misconfigured')
  }

  const redirectUri = new URL('/api/auth/sso/callback', request.url).toString()

  // Exchange code for tokens
  let tokenData: Record<string, unknown>
  try {
    const tokenRes = await fetch(`${config.issuerUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    })
    if (!tokenRes.ok) {
      return signinError(request, 'sso_token_exchange_failed')
    }
    tokenData = await tokenRes.json()
  } catch {
    return signinError(request, 'sso_token_exchange_failed')
  }

  const accessToken = tokenData.access_token as string | undefined
  if (!accessToken) {
    return signinError(request, 'sso_no_access_token')
  }

  // Fetch user info
  let userInfo: Record<string, unknown>
  try {
    const userRes = await fetch(`${config.issuerUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!userRes.ok) {
      return signinError(request, 'sso_userinfo_failed')
    }
    userInfo = await userRes.json()
  } catch {
    return signinError(request, 'sso_userinfo_failed')
  }

  const email = (userInfo.email as string) ?? null
  const name = (userInfo.name as string) ?? (userInfo.preferred_username as string) ?? null
  const image = (userInfo.picture as string) ?? null
  const sub = userInfo.sub as string

  if (!email && !sub) {
    return signinError(request, 'sso_no_identifier')
  }

  // Find or create user
  let user = email
    ? await db.query.users.findFirst({ where: eq(users.email, email) })
    : undefined

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({ name, email, image })
      .onConflictDoNothing()
      .returning()
    user = created ?? (email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : undefined)
  }

  if (!user) {
    return signinError(request, 'sso_user_creation_failed')
  }

  // Link SSO account if not already linked
  const existingAccount = await db.query.accounts.findFirst({
    where: eq(accounts.userId, user.id),
  })
  if (!existingAccount) {
    await db
      .insert(accounts)
      .values({
        userId: user.id,
        type: 'oidc',
        provider: `sso-${config.id}`,
        providerAccountId: sub,
        access_token: accessToken,
        id_token: (tokenData.id_token as string) ?? undefined,
      })
      .onConflictDoNothing()
  }

  // Auto-provision workspace membership
  if (config.autoProvision) {
    const role = config.defaultRole === 'admin' ? 'admin' : 'member'
    await db
      .insert(workspaceMembers)
      .values({
        userId: user.id,
        workspaceId: config.workspaceId,
        role,
      })
      .onConflictDoNothing()
  }

  // Create JWT session
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    return signinError(request, 'sso_server_error')
  }

  const secureCookie = request.url.startsWith('https')
  const cookieName = secureCookie
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const token = await encode({
    token: { id: user.id, name: user.name, email: user.email, picture: user.image },
    secret,
    salt: cookieName,
    maxAge: 30 * 24 * 60 * 60,
  })

  const response = NextResponse.redirect(new URL('/docs', request.url))

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })

  return response
}
