import { eq } from 'drizzle-orm'

import { db } from '../db'
import {
  mergePersonalFeatureVisibility,
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
    webhooks: row.webhooksEnabled,
    linkHealth: row.linkHealthEnabled,
    quickInsert: row.quickInsertEnabled,
  })
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

  if (typeof updates.webhooks === 'boolean') {
    nextUpdates.webhooksEnabled = updates.webhooks
  }

  if (typeof updates.linkHealth === 'boolean') {
    nextUpdates.linkHealthEnabled = updates.linkHealth
  }

  if (typeof updates.quickInsert === 'boolean') {
    nextUpdates.quickInsertEnabled = updates.quickInsert
  }

  return nextUpdates
}

export async function getUserFeatureVisibility(userId: string) {
  try {
    const row = await db.query.userFeaturePreferences.findFirst({
      where: eq(userFeaturePreferences.userId, userId),
    })

    return mapRowToFeatureVisibility(row)
  } catch (error) {
    console.error('Failed to load user feature visibility', {
      userId,
      error,
    })
    return mergePersonalFeatureVisibility()
  }
}

export async function updateUserFeatureVisibility(
  userId: string,
  updates: Partial<PersonalFeatureVisibility>,
) {
  const dbUpdates = mapFeatureVisibilityUpdates(updates)

  if (Object.keys(dbUpdates).length === 0) {
    return getUserFeatureVisibility(userId)
  }

  try {
    const [row] = await db
      .insert(userFeaturePreferences)
      .values({
        userId,
        ...dbUpdates,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userFeaturePreferences.userId],
        set: {
          ...dbUpdates,
          updatedAt: new Date(),
        },
      })
      .returning()

    return mapRowToFeatureVisibility(row)
  } catch (error) {
    console.error('Failed to update user feature visibility', {
      userId,
      updates: dbUpdates,
      error,
    })
    return getUserFeatureVisibility(userId)
  }
}
