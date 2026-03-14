import { NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { deletePartnerGroup } from '@/lib/queries/partner-groups'
import { db } from '@/lib/db'
import { partnerGroups } from '@/lib/schema'
import { and, eq, isNull } from 'drizzle-orm'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params

  // Verify the group belongs to this workspace before deleting
  const [group] = await db
    .select({ id: partnerGroups.id })
    .from(partnerGroups)
    .where(
      and(
        eq(partnerGroups.id, id),
        eq(partnerGroups.workspaceId, result.ctx.workspaceId),
        isNull(partnerGroups.deletedAt),
      ),
    )
    .limit(1)

  if (!group) return notFound()

  await deletePartnerGroup(id, result.ctx.workspaceId)
  return NextResponse.json({ success: true })
}
