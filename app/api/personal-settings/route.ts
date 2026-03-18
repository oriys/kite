import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import {
  PERSONAL_FEATURE_IDS,
  isValidNavOrder,
  type PersonalFeatureVisibility,
  type NavItemKey,
} from '@/lib/personal-settings'
import {
  getUserFeatureVisibility,
  updateUserFeatureVisibility,
} from '@/lib/queries/personal-settings'

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const data = await getUserFeatureVisibility(result.ctx.userId)
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const updates: Partial<PersonalFeatureVisibility> = {}

  for (const key of PERSONAL_FEATURE_IDS) {
    if (typeof body[key] === 'boolean') {
      updates[key] = body[key]
    }
  }

  let navOrder: NavItemKey[] | null | undefined
  if (body.navOrder !== undefined) {
    if (body.navOrder === null) {
      navOrder = null
    } else if (isValidNavOrder(body.navOrder)) {
      navOrder = body.navOrder as NavItemKey[]
    } else {
      return badRequest('navOrder must be a valid permutation of nav item keys')
    }
  }

  const data = await updateUserFeatureVisibility(
    result.ctx.userId,
    updates,
    navOrder,
  )

  return NextResponse.json(data)
}
