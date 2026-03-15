import { NextRequest, NextResponse } from 'next/server'
import { getSsoConfigByWorkspaceSlug } from '@/lib/queries/sso'

export async function GET(request: NextRequest) {
  const workspace = request.nextUrl.searchParams.get('workspace')
  if (!workspace) {
    return NextResponse.redirect(
      new URL('/auth/signin?error=missing_workspace', request.url),
    )
  }

  const config = await getSsoConfigByWorkspaceSlug(workspace)
  if (!config) {
    return NextResponse.redirect(
      new URL('/auth/signin?error=sso_not_configured', request.url),
    )
  }

  if (!config.issuerUrl || !config.clientId) {
    return NextResponse.redirect(
      new URL('/auth/signin?error=sso_misconfigured', request.url),
    )
  }

  const state = Buffer.from(
    JSON.stringify({ workspaceId: config.workspaceId, configId: config.id }),
  ).toString('base64url')

  const redirectUri = new URL('/api/auth/sso/callback', request.url).toString()

  const authUrl = new URL(`${config.issuerUrl}/authorize`)
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
