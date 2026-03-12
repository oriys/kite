import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import {
  getApiVersion,
  updateApiVersion,
  deleteApiVersion,
  setDefaultVersion,
} from '@/lib/queries/api-versions'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/
const MAX_SLUG_LENGTH = 32
const VALID_STATUSES = ['active', 'beta', 'deprecated', 'retired'] as const

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id } = await context.params
  const version = await getApiVersion(id)
  if (!version || version.workspaceId !== result.ctx.workspaceId)
    return notFound()

  return NextResponse.json(version)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await context.params
  const existing = await getApiVersion(id)
  if (!existing || existing.workspaceId !== result.ctx.workspaceId)
    return notFound()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const patch: Parameters<typeof updateApiVersion>[1] = {}

  if (typeof body.label === 'string') {
    const label = body.label.trim()
    if (!label) return badRequest('Label cannot be empty')
    patch.label = label
  }

  if (typeof body.slug === 'string') {
    const slug = body.slug.trim()
    if (slug.length > MAX_SLUG_LENGTH)
      return badRequest(`Slug must be at most ${MAX_SLUG_LENGTH} characters`)
    if (!SLUG_RE.test(slug))
      return badRequest(
        'Slug must be lowercase alphanumeric with hyphens, starting with a letter or digit',
      )
    patch.slug = slug
  }

  if (typeof body.baseUrl === 'string') patch.baseUrl = body.baseUrl.trim()
  if (typeof body.sortOrder === 'number') patch.sortOrder = body.sortOrder

  if (typeof body.status === 'string') {
    if (!VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number]))
      return badRequest('Invalid status')
    patch.status = body.status as (typeof VALID_STATUSES)[number]
  }

  if (typeof body.isDefault === 'boolean' && body.isDefault) {
    const updated = await setDefaultVersion(result.ctx.workspaceId, id)
    if (!updated) return notFound()
    return NextResponse.json(updated)
  }

  if (Object.keys(patch).length === 0)
    return badRequest('No valid fields to update')

  try {
    const updated = await updateApiVersion(id, patch)
    if (!updated) return notFound()
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to update version'
    if (message.includes('unique') || message.includes('duplicate'))
      return badRequest('A version with this slug already exists')
    return badRequest(message)
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await context.params
  const existing = await getApiVersion(id)
  if (!existing || existing.workspaceId !== result.ctx.workspaceId)
    return notFound()

  const deleted = await deleteApiVersion(id)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}
