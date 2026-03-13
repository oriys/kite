import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import {
  PERSONAL_FEATURE_IDS,
  type PersonalFeatureVisibility,
} from '@/lib/personal-settings'
import {
  getUserFeatureVisibility,
  updateUserFeatureVisibility,
} from '@/lib/queries/personal-settings'

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const featureVisibility = await getUserFeatureVisibility(result.ctx.userId)
  return NextResponse.json(featureVisibility)
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

  const featureVisibility = await updateUserFeatureVisibility(
    result.ctx.userId,
    updates,
  )

  return NextResponse.json(featureVisibility)
}
