import { desc, eq, and, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  mergeNotificationPreferences,
  type NotificationPreferenceValues,
} from '../notification-preferences'
import { notifications, notificationPreferences } from '../schema'

type NotificationType = (typeof notifications.$inferInsert)['type']

interface CreateNotificationInput {
  recipientId: string
  workspaceId: string
  type: NotificationType
  title: string
  body?: string
  linkUrl?: string
  resourceType?: string
  resourceId?: string
  actorId?: string
}

export async function createNotification(input: CreateNotificationInput) {
  const [n] = await db
    .insert(notifications)
    .values({
      recipientId: input.recipientId,
      workspaceId: input.workspaceId,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      linkUrl: input.linkUrl ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      actorId: input.actorId ?? null,
    })
    .returning()
  return n
}

export async function createBulkNotifications(
  inputs: CreateNotificationInput[],
) {
  if (inputs.length === 0) return []
  return db.insert(notifications).values(inputs).returning()
}

export async function listNotifications(
  userId: string,
  workspaceId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
) {
  const { limit = 30, offset = 0, unreadOnly = false } = options
  const baseConditions = [
    eq(notifications.recipientId, userId),
    eq(notifications.workspaceId, workspaceId),
  ]
  const listConditions = unreadOnly
    ? [...baseConditions, eq(notifications.isRead, false)]
    : baseConditions

  const [items, unreadRows] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        linkUrl: notifications.linkUrl,
        resourceType: notifications.resourceType,
        resourceId: notifications.resourceId,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(...listConditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...baseConditions, eq(notifications.isRead, false))),
  ])

  return { items, unreadCount: Number(unreadRows[0]?.count ?? 0) }
}

export async function markNotificationRead(id: string, userId: string) {
  const [n] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, userId)))
    .returning()
  return n ?? null
}

export async function markAllNotificationsRead(
  userId: string,
  workspaceId: string,
) {
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientId, userId),
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.isRead, false),
      ),
    )
}

export async function getNotificationPreferences(
  userId: string,
  workspaceId: string,
) {
  const prefs = await db.query.notificationPreferences.findFirst({
    where: and(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.workspaceId, workspaceId),
    ),
  })

  return mergeNotificationPreferences(prefs)
}

export async function updateNotificationPreferences(
  userId: string,
  workspaceId: string,
  prefs: Partial<NotificationPreferenceValues>,
) {
  const [result] = await db
    .insert(notificationPreferences)
    .values({ userId, workspaceId, ...prefs })
    .onConflictDoUpdate({
      target: [
        notificationPreferences.userId,
        notificationPreferences.workspaceId,
      ],
      set: prefs,
    })
    .returning()

  return mergeNotificationPreferences(result)
}

/** Extract @mentions from text content, returns array of usernames */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1])
  }
  return [...new Set(mentions)]
}
