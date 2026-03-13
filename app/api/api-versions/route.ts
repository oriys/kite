import { NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  listApiVersions,
  createApiVersion,
} from '@/lib/queries/api-versions'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/
const MAX_SLUG_LENGTH = 32
const VALID_STATUSES = ['active', 'beta', 'deprecated', 'retired'] as const

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const versions = await listApiVersions(result.ctx.workspaceId)
  return NextResponse.json(versions)
}

export async function POST(request: Request) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const label = typeof body.label === 'string' ? body.label.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const baseUrl =
    typeof body.baseUrl === 'string' ? body.baseUrl.trim() : undefined
  const status =
    typeof body.status === 'string' && VALID_STATUSES.includes(body.status)
      ? (body.status as (typeof VALID_STATUSES)[number])
      : undefined

  if (!label) return badRequest('Label is required')
  if (!slug) return badRequest('Slug is required')
  if (slug.length > MAX_SLUG_LENGTH)
    return badRequest(`Slug must be at most ${MAX_SLUG_LENGTH} characters`)
  if (!SLUG_RE.test(slug))
    return badRequest(
      'Slug must be lowercase alphanumeric with hyphens, starting with a letter or digit',
    )

  try {
    const version = await createApiVersion({
      workspaceId: result.ctx.workspaceId,
      label,
      slug,
      baseUrl,
      status,
    })

    return NextResponse.json(version, { status: 201 })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to create version'
    if (message.includes('unique') || message.includes('duplicate'))
      return badRequest('A version with this slug already exists')
    return badRequest(message)
  }
}
