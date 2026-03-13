import { desc, eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '../db'
import { auditLogs, users } from '../schema'

export type AuditAction = (typeof auditLogs.$inferInsert)['action']

interface EmitAuditEventInput {
  workspaceId: string
  actorId: string | null
  action: AuditAction
  resourceType: string
  resourceId: string
  resourceTitle?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export async function emitAuditEvent(input: EmitAuditEventInput) {
  const [log] = await db
    .insert(auditLogs)
    .values({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceTitle: input.resourceTitle ?? null,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
    })
    .returning()
  return log
}

export async function listAuditLogs(
  workspaceId: string,
  options: {
    limit?: number
    offset?: number
    action?: AuditAction
    resourceType?: string
    actorId?: string
    from?: Date
    to?: Date
  } = {},
) {
  const { limit = 50, offset = 0, action, resourceType, actorId, from, to } =
    options
  const conditions = [eq(auditLogs.workspaceId, workspaceId)]

  if (action) conditions.push(eq(auditLogs.action, action))
  if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType))
  if (actorId) conditions.push(eq(auditLogs.actorId, actorId))
  if (from) conditions.push(gte(auditLogs.createdAt, from))
  if (to) conditions.push(lte(auditLogs.createdAt, to))

  const [logs, [{ count }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        actorName: users.name,
        actorImage: users.image,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceTitle: auditLogs.resourceTitle,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(...conditions)),
  ])

  return { logs, total: Number(count) }
}
