import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getPublicationSnapshot } from '@/lib/queries/publications'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id, version: versionStr } = await params
  const version = Number(versionStr)
  if (!Number.isFinite(version) || version < 1) return notFound()

  const snapshot = await getPublicationSnapshot(id, result.ctx.workspaceId, version)
  if (!snapshot) return notFound()

  // Support diff comparison
  const diffWith = request.nextUrl.searchParams.get('diff_with')
  if (diffWith) {
    const diffVersion = Number(diffWith)
    if (Number.isFinite(diffVersion)) {
      const other = await getPublicationSnapshot(id, result.ctx.workspaceId, diffVersion)
      if (other) {
        return NextResponse.json({ current: snapshot, compareTo: other })
      }
    }
  }

  return NextResponse.json(snapshot)
}
