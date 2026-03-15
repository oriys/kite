import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { recordPageView } from '@/lib/queries/page-analytics'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, documentId, path, referrer, sessionId, source } = body

    if (!workspaceId || !path) {
      return NextResponse.json(
        { error: 'workspaceId and path are required' },
        { status: 400 },
      )
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      )
    }

    await recordPageView({
      workspaceId,
      documentId: documentId ?? null,
      path,
      referrer: referrer ?? request.headers.get('referer'),
      userAgent: request.headers.get('user-agent'),
      sessionId: sessionId ?? null,
      source: source ?? 'internal',
    })

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json(
      { error: 'Failed to record page view' },
      { status: 500 },
    )
  }
}
