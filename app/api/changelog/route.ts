import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { generateChangelog } from '@/lib/changelog-generator'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const documentId = searchParams.get('documentId') ?? undefined
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)

  const changelog = await generateChangelog(result.ctx.workspaceId, {
    limit,
    documentId,
  })

  return NextResponse.json(changelog)
}
