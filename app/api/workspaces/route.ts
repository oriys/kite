import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  getAuthenticatedUser,
  resolveAuthenticatedUser,
  unauthorized,
  badRequest,
} from '@/lib/api-utils'
import {
  ensureDefaultWorkspace,
  getUserWorkspaces,
  createWorkspace,
} from '@/lib/queries/workspaces'

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/
const MAX_NAME_LENGTH = 100
const MAX_SLUG_LENGTH = 60

export async function GET() {
  const sessionUser = await getAuthenticatedUser()
  if (!sessionUser?.id) return unauthorized()

  const user = await resolveAuthenticatedUser(sessionUser)
  if (!user?.id) return unauthorized()

  let workspaces = await getUserWorkspaces(user.id)
  if (workspaces.length === 0) {
    await ensureDefaultWorkspace(user.id, user.name ?? 'My Workspace')
    workspaces = await getUserWorkspaces(user.id)
  }

  return NextResponse.json(workspaces)
}

export async function POST(request: NextRequest) {
  const sessionUser = await getAuthenticatedUser()
  if (!sessionUser?.id) return unauthorized()

  const user = await resolveAuthenticatedUser(sessionUser)
  if (!user?.id) return unauthorized()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''

  if (!name || !slug) return badRequest('Name and slug are required')
  if (name.length > MAX_NAME_LENGTH) return badRequest('Name too long')
  if (slug.length > MAX_SLUG_LENGTH) return badRequest('Slug too long')
  if (!SLUG_PATTERN.test(slug)) {
    return badRequest('Slug must contain only lowercase letters, numbers, hyphens, and underscores')
  }

  try {
    const workspace = await createWorkspace(name, slug, user.id)
    return NextResponse.json(workspace, { status: 201 })
  } catch {
    return badRequest('Slug already in use')
  }
}
