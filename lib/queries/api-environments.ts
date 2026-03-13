import { desc, eq, and, isNull, notInArray } from 'drizzle-orm'
import { db } from '../db'
import {
  apiEnvironments,
  apiAuthConfigs,
  apiRequestHistory,
} from '../schema'

const REQUEST_HISTORY_BODY_MAX_LENGTH = 20_000
const REQUEST_HISTORY_ROWS_PER_USER = 200

function truncateHistoryText(value?: string | null) {
  if (!value) return null
  return value.length > REQUEST_HISTORY_BODY_MAX_LENGTH
    ? value.slice(0, REQUEST_HISTORY_BODY_MAX_LENGTH)
    : value
}

// ─── Environments ───────────────────────────────────────────────

export async function createEnvironment(
  workspaceId: string,
  name: string,
  baseUrl: string,
  variables: Record<string, string> = {},
) {
  const [env] = await db
    .insert(apiEnvironments)
    .values({ workspaceId, name, baseUrl, variables })
    .returning()
  return env
}

export async function listEnvironments(workspaceId: string) {
  return db
    .select({
      id: apiEnvironments.id,
      workspaceId: apiEnvironments.workspaceId,
      name: apiEnvironments.name,
      baseUrl: apiEnvironments.baseUrl,
      isDefault: apiEnvironments.isDefault,
      createdAt: apiEnvironments.createdAt,
      updatedAt: apiEnvironments.updatedAt,
    })
    .from(apiEnvironments)
    .where(
      and(
        eq(apiEnvironments.workspaceId, workspaceId),
        isNull(apiEnvironments.deletedAt),
      ),
    )
    .orderBy(desc(apiEnvironments.createdAt))
}

export async function getEnvironment(id: string) {
  return (await db.query.apiEnvironments.findFirst({
    where: and(eq(apiEnvironments.id, id), isNull(apiEnvironments.deletedAt)),
  })) ?? null
}

export async function updateEnvironment(
  id: string,
  data: Partial<{
    name: string
    baseUrl: string
    variables: Record<string, string>
    isDefault: boolean
  }>,
) {
  const [env] = await db
    .update(apiEnvironments)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(apiEnvironments.id, id), isNull(apiEnvironments.deletedAt)))
    .returning()
  return env ?? null
}

export async function deleteEnvironment(id: string) {
  await db
    .update(apiEnvironments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(apiEnvironments.id, id), isNull(apiEnvironments.deletedAt)))
}

// ─── Auth Configs ───────────────────────────────────────────────

export async function createAuthConfig(
  workspaceId: string,
  name: string,
  authType: (typeof apiAuthConfigs.$inferInsert)['authType'],
  config: Record<string, string> = {},
) {
  const [ac] = await db
    .insert(apiAuthConfigs)
    .values({ workspaceId, name, authType, config })
    .returning()
  return ac
}

export async function listAuthConfigs(workspaceId: string) {
  return db
    .select({
      id: apiAuthConfigs.id,
      workspaceId: apiAuthConfigs.workspaceId,
      name: apiAuthConfigs.name,
      authType: apiAuthConfigs.authType,
      createdAt: apiAuthConfigs.createdAt,
      updatedAt: apiAuthConfigs.updatedAt,
    })
    .from(apiAuthConfigs)
    .where(
      and(
        eq(apiAuthConfigs.workspaceId, workspaceId),
        isNull(apiAuthConfigs.deletedAt),
      ),
    )
    .orderBy(desc(apiAuthConfigs.createdAt))
}

export async function updateAuthConfig(
  id: string,
  data: Partial<{
    name: string
    authType: (typeof apiAuthConfigs.$inferInsert)['authType']
    config: Record<string, string>
  }>,
) {
  const [ac] = await db
    .update(apiAuthConfigs)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(apiAuthConfigs.id, id), isNull(apiAuthConfigs.deletedAt)))
    .returning()
  return ac ?? null
}

export async function deleteAuthConfig(id: string) {
  await db
    .update(apiAuthConfigs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(apiAuthConfigs.id, id), isNull(apiAuthConfigs.deletedAt)))
}

// ─── Request History ────────────────────────────────────────────

export async function saveRequestHistory(
  workspaceId: string,
  userId: string | null,
  data: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: string
    responseStatus?: number
    responseHeaders?: Record<string, string>
    responseBody?: string
    durationMs?: number
    environmentId?: string
  },
) {
  const [record] = await db
    .insert(apiRequestHistory)
    .values({
      workspaceId,
      userId,
      method: data.method,
      url: data.url,
      headers: data.headers ?? {},
      body: truncateHistoryText(data.body),
      responseStatus: data.responseStatus ?? null,
      responseHeaders: data.responseHeaders ?? {},
      responseBody: truncateHistoryText(data.responseBody),
      durationMs: data.durationMs ?? null,
      environmentId: data.environmentId ?? null,
    })
    .returning()

  if (userId) {
    const keepIds = db
      .select({ id: apiRequestHistory.id })
      .from(apiRequestHistory)
      .where(
        and(
          eq(apiRequestHistory.workspaceId, workspaceId),
          eq(apiRequestHistory.userId, userId),
          isNull(apiRequestHistory.deletedAt),
        ),
      )
      .orderBy(desc(apiRequestHistory.createdAt))
      .limit(REQUEST_HISTORY_ROWS_PER_USER)

    await db
      .delete(apiRequestHistory)
      .where(
        and(
          eq(apiRequestHistory.workspaceId, workspaceId),
          eq(apiRequestHistory.userId, userId),
          isNull(apiRequestHistory.deletedAt),
          notInArray(apiRequestHistory.id, keepIds),
        ),
      )
  }

  return record
}

export async function listRequestHistory(
  workspaceId: string,
  options: { userId?: string; limit?: number; offset?: number } = {},
) {
  const { userId, limit = 50, offset = 0 } = options
  const conditions = [
    eq(apiRequestHistory.workspaceId, workspaceId),
    isNull(apiRequestHistory.deletedAt),
  ]
  if (userId) conditions.push(eq(apiRequestHistory.userId, userId))

  return db
    .select({
      id: apiRequestHistory.id,
      method: apiRequestHistory.method,
      url: apiRequestHistory.url,
      responseStatus: apiRequestHistory.responseStatus,
      durationMs: apiRequestHistory.durationMs,
      environmentId: apiRequestHistory.environmentId,
      createdAt: apiRequestHistory.createdAt,
    })
    .from(apiRequestHistory)
    .where(and(...conditions))
    .orderBy(desc(apiRequestHistory.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function clearRequestHistory(workspaceId: string) {
  await db
    .update(apiRequestHistory)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(apiRequestHistory.workspaceId, workspaceId),
        isNull(apiRequestHistory.deletedAt),
      ),
    )
}
