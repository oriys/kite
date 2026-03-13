import { eq, and, isNull, lt, desc } from 'drizzle-orm'
import { db } from '../db'
import { workspaceInvites, workspaceMembers, users } from '../schema'
import { emitAuditEvent } from './audit-logs'
import type { MemberRole } from './members'

const INVITE_EXPIRY_DAYS = 7

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export interface WorkspaceInvite {
  id: string
  workspaceId: string
  email: string | null
  role: MemberRole
  token: string
  type: 'email' | 'link'
  invitedBy: string
  inviterName: string | null
  expiresAt: Date
  acceptedAt: Date | null
  createdAt: Date
}

export async function createEmailInvite(
  workspaceId: string,
  email: string,
  role: MemberRole,
  invitedBy: string,
): Promise<WorkspaceInvite> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const [invite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId,
      email: email.toLowerCase().trim(),
      role,
      token,
      type: 'email',
      invitedBy,
      expiresAt,
    })
    .returning()

  await emitAuditEvent({
    workspaceId,
    actorId: invitedBy,
    action: 'invite',
    resourceType: 'invite',
    resourceId: invite.id,
    metadata: { email, role, type: 'email' },
  })

  return { ...invite, inviterName: null } as WorkspaceInvite
}

export async function createLinkInvite(
  workspaceId: string,
  role: MemberRole,
  invitedBy: string,
): Promise<WorkspaceInvite> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const [invite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId,
      role,
      token,
      type: 'link',
      invitedBy,
      expiresAt,
    })
    .returning()

  await emitAuditEvent({
    workspaceId,
    actorId: invitedBy,
    action: 'invite',
    resourceType: 'invite',
    resourceId: invite.id,
    metadata: { role, type: 'link' },
  })

  return { ...invite, inviterName: null } as WorkspaceInvite
}

export async function listPendingInvites(
  workspaceId: string,
): Promise<WorkspaceInvite[]> {
  const rows = await db
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      email: workspaceInvites.email,
      role: workspaceInvites.role,
      token: workspaceInvites.token,
      type: workspaceInvites.type,
      invitedBy: workspaceInvites.invitedBy,
      inviterName: users.name,
      expiresAt: workspaceInvites.expiresAt,
      acceptedAt: workspaceInvites.acceptedAt,
      createdAt: workspaceInvites.createdAt,
    })
    .from(workspaceInvites)
    .leftJoin(users, eq(workspaceInvites.invitedBy, users.id))
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt),
      ),
    )
    .orderBy(desc(workspaceInvites.createdAt))

  return rows as WorkspaceInvite[]
}

export async function revokeInvite(
  workspaceId: string,
  inviteId: string,
  _actorId: string,
) {
  const [deleted] = await db
    .delete(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt),
      ),
    )
    .returning()

  if (!deleted) throw new Error('Invite not found or already accepted')

  return deleted
}

export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ workspaceId: string; role: MemberRole }> {
  const [invite] = await db
    .select({
      id: workspaceInvites.id,
      workspaceId: workspaceInvites.workspaceId,
      role: workspaceInvites.role,
      type: workspaceInvites.type,
      invitedBy: workspaceInvites.invitedBy,
      expiresAt: workspaceInvites.expiresAt,
      acceptedAt: workspaceInvites.acceptedAt,
    })
    .from(workspaceInvites)
    .where(eq(workspaceInvites.token, token))

  if (!invite) throw new Error('Invalid invite')
  if (invite.acceptedAt) throw new Error('Invite already used')
  if (invite.expiresAt < new Date()) throw new Error('Invite expired')

  // Check if already a member
  const [existing] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, invite.workspaceId),
      ),
    )

  if (existing) throw new Error('Already a workspace member')

  // Add member
  await db.insert(workspaceMembers).values({
    userId,
    workspaceId: invite.workspaceId,
    role: invite.role,
    invitedBy: invite.invitedBy,
  })

  // Mark invite accepted
  await db
    .update(workspaceInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(workspaceInvites.id, invite.id))

  await emitAuditEvent({
    workspaceId: invite.workspaceId,
    actorId: userId,
    action: 'member_add',
    resourceType: 'member',
    resourceId: userId,
    metadata: { role: invite.role, inviteType: invite.type },
  })

  return { workspaceId: invite.workspaceId, role: invite.role as MemberRole }
}

export async function cleanExpiredInvites(workspaceId: string) {
  await db
    .delete(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        isNull(workspaceInvites.acceptedAt),
        lt(workspaceInvites.expiresAt, new Date()),
      ),
    )
}
