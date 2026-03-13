import { db } from '@/lib/db'
import { partnerGroups, partnerGroupMembers } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'

export type VisibilityLevel = 'public' | 'partner' | 'private'

/**
 * Check if a user belongs to any partner group in a workspace.
 */
export async function isUserInPartnerGroup(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const row = await db
    .select({ groupId: partnerGroupMembers.groupId })
    .from(partnerGroupMembers)
    .innerJoin(partnerGroups, eq(partnerGroups.id, partnerGroupMembers.groupId))
    .where(
      and(
        eq(partnerGroupMembers.userId, userId),
        eq(partnerGroups.workspaceId, workspaceId),
        isNull(partnerGroupMembers.deletedAt),
        isNull(partnerGroups.deletedAt),
      ),
    )
    .limit(1)

  return row.length > 0
}

/**
 * Returns the list of visibility levels accessible to a user.
 *
 * - Workspace members (any role) see everything.
 * - Partner-group members see public + partner.
 * - Anonymous / external users see public only.
 */
export async function getUserVisibilityFilter(
  workspaceId: string,
  userId: string | null,
  role: string | null,
): Promise<VisibilityLevel[]> {
  // Workspace members can see all visibility levels
  if (role) return ['public', 'partner', 'private']

  // Anonymous users can only see public
  if (!userId) return ['public']

  // External users who belong to a partner group can see partner content
  const isPartner = await isUserInPartnerGroup(userId, workspaceId)
  if (isPartner) return ['public', 'partner']

  return ['public']
}

/**
 * Returns IDs of documents visible to a user, applying visibility filtering.
 * Delegates to getUserVisibilityFilter for the allowed levels, then queries
 * documents whose visibility matches.
 */
export async function getVisibleDocuments(
  workspaceId: string,
  userId: string | null,
  role: string | null,
): Promise<string[]> {
  const { documents } = await import('@/lib/schema')
  const { inArray } = await import('drizzle-orm')

  const allowedLevels = await getUserVisibilityFilter(workspaceId, userId, role)

  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        inArray(documents.visibility, allowedLevels),
        isNull(documents.deletedAt),
      ),
    )

  return rows.map((r) => r.id)
}
