import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthenticatedUser, badRequest, unauthorized } from '@/lib/api-utils'
import { acceptInvite } from '@/lib/queries/invites'

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user?.id) return unauthorized()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) return badRequest('Token is required')

  try {
    const result = await acceptInvite(token, user.id, user.email)
    return NextResponse.json(result)
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
