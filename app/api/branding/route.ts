import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { getWorkspaceBranding, upsertWorkspaceBranding } from '@/lib/queries/branding'

export async function GET() {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const branding = await getWorkspaceBranding(result.ctx.workspaceId)
  return NextResponse.json(branding ?? {})
}

export async function PUT(request: NextRequest) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const allowed = [
    'logoUrl', 'faviconUrl', 'primaryColor', 'accentColor',
    'customDomain', 'customCss', 'metaTitle', 'metaDescription', 'ogImageUrl',
  ] as const

  const data: Record<string, string | null> = {}
  for (const key of allowed) {
    if (key in body) {
      data[key] = typeof body[key] === 'string' ? body[key] : null
    }
  }

  const branding = await upsertWorkspaceBranding(result.ctx.workspaceId, data)
  return NextResponse.json(branding)
}
