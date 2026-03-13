import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { createTemplate, listTemplates } from '@/lib/queries/templates'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const category = request.nextUrl.searchParams.get('category') as
    | 'getting-started'
    | 'api-reference'
    | 'changelog'
    | 'migration-guide'
    | 'tutorial'
    | 'troubleshooting'
    | 'custom'
    | null

  const items = await listTemplates(
    result.ctx.workspaceId,
    category ?? undefined,
  )
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('Name is required')

  const tpl = await createTemplate(result.ctx.workspaceId, {
    name,
    description: body.description,
    category: body.category,
    content: body.content ?? '',
    thumbnail: body.thumbnail,
    createdBy: result.ctx.userId,
  })

  return NextResponse.json(tpl, { status: 201 })
}
