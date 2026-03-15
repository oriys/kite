import { desc, eq, and } from 'drizzle-orm'
import { db } from '../db'
import { notificationChannels, channelDeliveries } from '../schema'

export async function createNotificationChannel(
  workspaceId: string,
  createdBy: string,
  data: {
    channelType: 'email' | 'slack_webhook'
    name: string
    config: Record<string, unknown>
    events: string[]
  },
) {
  const [channel] = await db
    .insert(notificationChannels)
    .values({
      workspaceId,
      createdBy,
      channelType: data.channelType,
      name: data.name,
      config: data.config,
      events: data.events,
    })
    .returning()
  return channel
}

export async function listNotificationChannels(workspaceId: string) {
  return db
    .select({
      id: notificationChannels.id,
      channelType: notificationChannels.channelType,
      name: notificationChannels.name,
      config: notificationChannels.config,
      events: notificationChannels.events,
      enabled: notificationChannels.enabled,
      createdAt: notificationChannels.createdAt,
      updatedAt: notificationChannels.updatedAt,
    })
    .from(notificationChannels)
    .where(eq(notificationChannels.workspaceId, workspaceId))
    .orderBy(desc(notificationChannels.createdAt))
}

export async function getNotificationChannel(
  id: string,
  workspaceId: string,
) {
  return (
    (await db.query.notificationChannels.findFirst({
      where: and(
        eq(notificationChannels.id, id),
        eq(notificationChannels.workspaceId, workspaceId),
      ),
    })) ?? null
  )
}

export async function updateNotificationChannel(
  id: string,
  workspaceId: string,
  data: Partial<{
    name: string
    config: Record<string, unknown>
    events: string[]
    enabled: boolean
  }>,
) {
  const [channel] = await db
    .update(notificationChannels)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(notificationChannels.id, id),
        eq(notificationChannels.workspaceId, workspaceId),
      ),
    )
    .returning()
  return channel ?? null
}

export async function deleteNotificationChannel(
  id: string,
  workspaceId: string,
) {
  await db
    .delete(notificationChannels)
    .where(
      and(
        eq(notificationChannels.id, id),
        eq(notificationChannels.workspaceId, workspaceId),
      ),
    )
}

export async function listChannelDeliveries(
  channelId: string,
  workspaceId: string,
  limit = 20,
  offset = 0,
) {
  const channel = await getNotificationChannel(channelId, workspaceId)
  if (!channel) return []

  return db
    .select({
      id: channelDeliveries.id,
      notificationType: channelDeliveries.notificationType,
      status: channelDeliveries.status,
      statusCode: channelDeliveries.statusCode,
      errorMessage: channelDeliveries.errorMessage,
      attemptCount: channelDeliveries.attemptCount,
      deliveredAt: channelDeliveries.deliveredAt,
      createdAt: channelDeliveries.createdAt,
    })
    .from(channelDeliveries)
    .where(eq(channelDeliveries.channelId, channelId))
    .orderBy(desc(channelDeliveries.createdAt))
    .limit(limit)
    .offset(offset)
}
