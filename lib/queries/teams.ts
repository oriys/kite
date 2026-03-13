import { eq, and, isNull, desc } from 'drizzle-orm'
import { db } from '../db'
import { teams, teamMembers, users } from '../schema'
import { emitAuditEvent } from './audit-logs'

export interface Team {
  id: string
  workspaceId: string
  name: string
  description: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  memberCount?: number
}

export interface TeamMember {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  joinedAt: Date
}

export async function listTeams(workspaceId: string): Promise<Team[]> {
  const rows = await db
    .select()
    .from(teams)
    .where(
      and(eq(teams.workspaceId, workspaceId), isNull(teams.deletedAt)),
    )
    .orderBy(teams.name)

  return rows
}

export async function getTeam(
  workspaceId: string,
  teamId: string,
): Promise<Team | null> {
  const [row] = await db
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.id, teamId),
        eq(teams.workspaceId, workspaceId),
        isNull(teams.deletedAt),
      ),
    )
  return row ?? null
}

export async function createTeam(
  workspaceId: string,
  name: string,
  description: string,
  parentId: string | null,
  actorId: string,
): Promise<Team> {
  if (parentId) {
    const parent = await getTeam(workspaceId, parentId)
    if (!parent) throw new Error('Parent team not found')
  }

  const [team] = await db
    .insert(teams)
    .values({ workspaceId, name, description, parentId })
    .returning()

  await emitAuditEvent({
    workspaceId,
    actorId,
    action: 'team_create',
    resourceType: 'team',
    resourceId: team.id,
    resourceTitle: name,
  })

  return team
}

export async function updateTeam(
  workspaceId: string,
  teamId: string,
  data: { name?: string; description?: string; parentId?: string | null },
  actorId: string,
): Promise<Team> {
  const existing = await getTeam(workspaceId, teamId)
  if (!existing) throw new Error('Team not found')

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === teamId) throw new Error('Team cannot be its own parent')
    const parent = await getTeam(workspaceId, data.parentId)
    if (!parent) throw new Error('Parent team not found')
  }

  const [updated] = await db
    .update(teams)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(teams.id, teamId), eq(teams.workspaceId, workspaceId)))
    .returning()

  await emitAuditEvent({
    workspaceId,
    actorId,
    action: 'team_update',
    resourceType: 'team',
    resourceId: teamId,
    resourceTitle: updated.name,
    metadata: data,
  })

  return updated
}

export async function deleteTeam(
  workspaceId: string,
  teamId: string,
  actorId: string,
) {
  const existing = await getTeam(workspaceId, teamId)
  if (!existing) throw new Error('Team not found')

  await db
    .update(teams)
    .set({ deletedAt: new Date() })
    .where(and(eq(teams.id, teamId), eq(teams.workspaceId, workspaceId)))

  await emitAuditEvent({
    workspaceId,
    actorId,
    action: 'team_delete',
    resourceType: 'team',
    resourceId: teamId,
    resourceTitle: existing.name,
  })
}

export async function listTeamMembers(
  teamId: string,
): Promise<TeamMember[]> {
  const rows = await db
    .select({
      userId: teamMembers.userId,
      name: users.name,
      email: users.email,
      image: users.image,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(desc(teamMembers.joinedAt))

  return rows
}

export async function addTeamMember(
  workspaceId: string,
  teamId: string,
  userId: string,
  actorId: string,
) {
  const team = await getTeam(workspaceId, teamId)
  if (!team) throw new Error('Team not found')

  await db
    .insert(teamMembers)
    .values({ teamId, userId })
    .onConflictDoNothing()

  await emitAuditEvent({
    workspaceId,
    actorId,
    action: 'member_add',
    resourceType: 'team_member',
    resourceId: `${teamId}:${userId}`,
    resourceTitle: team.name,
  })
}

export async function removeTeamMember(
  workspaceId: string,
  teamId: string,
  userId: string,
  actorId: string,
) {
  const team = await getTeam(workspaceId, teamId)
  if (!team) throw new Error('Team not found')

  await db
    .delete(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    )

  await emitAuditEvent({
    workspaceId,
    actorId,
    action: 'member_remove',
    resourceType: 'team_member',
    resourceId: `${teamId}:${userId}`,
    resourceTitle: team.name,
  })
}
