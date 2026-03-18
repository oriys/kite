import { eq } from 'drizzle-orm'

import { db } from '../db'
import {
  mergeNavOrder,
  mergePersonalFeatureVisibility,
  type NavItemKey,
  type PersonalFeatureVisibility,
} from '../personal-settings'
import { userFeaturePreferences } from '../schema'

type UserFeaturePreferencesRow = typeof userFeaturePreferences.$inferSelect
type UserFeaturePreferencesInsert = typeof userFeaturePreferences.$inferInsert

function mapRowToFeatureVisibility(
  row?: UserFeaturePreferencesRow | null,
): PersonalFeatureVisibility {
  if (!row) {
    return mergePersonalFeatureVisibility()
  }

  return mergePersonalFeatureVisibility({
    openApi: row.openApiEnabled,
    templates: row.templatesEnabled,
    aiWorkspace: row.aiWorkspaceEnabled,
    analytics: row.analyticsEnabled,
    approvals: row.approvalsEnabled,
    linkHealth: row.linkHealthEnabled,
  })
}

function mapRowToNavOrder(
  row?: UserFeaturePreferencesRow | null,
): NavItemKey[] {
  return mergeNavOrder(row?.navOrder)
}

function mapFeatureVisibilityUpdates(
  updates: Partial<PersonalFeatureVisibility>,
): Partial<UserFeaturePreferencesInsert> {
  const nextUpdates: Partial<UserFeaturePreferencesInsert> = {}

  if (typeof updates.openApi === 'boolean') {
    nextUpdates.openApiEnabled = updates.openApi
  }

  if (typeof updates.templates === 'boolean') {
    nextUpdates.templatesEnabled = updates.templates
  }

  if (typeof updates.aiWorkspace === 'boolean') {
    nextUpdates.aiWorkspaceEnabled = updates.aiWorkspace
  }

  if (typeof updates.analytics === 'boolean') {
    nextUpdates.analyticsEnabled = updates.analytics
  }

  if (typeof updates.approvals === 'boolean') {
    nextUpdates.approvalsEnabled = updates.approvals
  }

  if (typeof updates.linkHealth === 'boolean') {
    nextUpdates.linkHealthEnabled = updates.linkHealth
  }

  return nextUpdates
}

export async function getUserFeatureVisibility(userId: string) {
  try {
    const row = await db.query.userFeaturePreferences.findFirst({
      where: eq(userFeaturePreferences.userId, userId),
    })

    return {
      ...mapRowToFeatureVisibility(row),
      navOrder: mapRowToNavOrder(row),
    }
  } catch (error) {
    console.error('Failed to load user feature visibility', {
      userId,
      error,
    })
    return {
      ...mergePersonalFeatureVisibility(),
      navOrder: mergeNavOrder(),
    }
  }
}

export async function updateUserFeatureVisibility(
  userId: string,
  updates: Partial<PersonalFeatureVisibility>,
  navOrder?: NavItemKey[] | null,
) {
  const dbUpdates = mapFeatureVisibilityUpdates(updates)

  const hasNavOrderUpdate = navOrder !== undefined
  if (Object.keys(dbUpdates).length === 0 && !hasNavOrderUpdate) {
    return getUserFeatureVisibility(userId)
  }

  const navOrderValue = hasNavOrderUpdate ? (navOrder ?? undefined) : undefined

  try {
    const [row] = await db
      .insert(userFeaturePreferences)
      .values({
        userId,
        ...dbUpdates,
        ...(navOrderValue !== undefined ? { navOrder: navOrderValue } : {}),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userFeaturePreferences.userId],
        set: {
          ...dbUpdates,
          ...(navOrderValue !== undefined ? { navOrder: navOrderValue } : {}),
          ...(hasNavOrderUpdate && navOrder === null ? { navOrder: null } : {}),
          updatedAt: new Date(),
        },
      })
      .returning()

    return {
      ...mapRowToFeatureVisibility(row),
      navOrder: mapRowToNavOrder(row),
    }
  } catch (error) {
    console.error('Failed to update user feature visibility', {
      userId,
      updates: dbUpdates,
      error,
    })
    return getUserFeatureVisibility(userId)
  }
}
