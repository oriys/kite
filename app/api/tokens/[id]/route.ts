import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { apiTokens } from '@/lib/schema'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('admin')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params

  await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.workspaceId, ctx.workspaceId)))

  return NextResponse.json({ ok: true })
}
