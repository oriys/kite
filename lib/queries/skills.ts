import { and, desc, eq } from 'drizzle-orm'

import { db } from '../db'
import { workspaceCliSkills } from '../schema'

type WorkspaceCliSkillRow = typeof workspaceCliSkills.$inferSelect

export interface WorkspaceCliSkillListItem {
  id: string
  slug: string
  name: string
  description: string
  sourceType: WorkspaceCliSkillRow['sourceType']
  source: string
  ref: string
  computedHash: string
  prompt: string
  enabled: boolean
  installedBy: string | null
  createdAt: string
  updatedAt: string
}

export function serializeWorkspaceCliSkill(
  row: WorkspaceCliSkillRow,
): WorkspaceCliSkillListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sourceType: row.sourceType,
    source: row.source,
    ref: row.ref ?? '',
    computedHash: row.computedHash ?? '',
    prompt: row.prompt ?? '',
    enabled: row.enabled,
    installedBy: row.installedBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listWorkspaceCliSkills(workspaceId: string) {
  return db.query.workspaceCliSkills.findMany({
    where: eq(workspaceCliSkills.workspaceId, workspaceId),
    orderBy: [desc(workspaceCliSkills.updatedAt), desc(workspaceCliSkills.createdAt)],
  })
}

export async function listEnabledWorkspaceCliSkills(workspaceId: string) {
  return db.query.workspaceCliSkills.findMany({
    where: and(
      eq(workspaceCliSkills.workspaceId, workspaceId),
      eq(workspaceCliSkills.enabled, true),
    ),
    orderBy: [desc(workspaceCliSkills.updatedAt), desc(workspaceCliSkills.createdAt)],
  })
}

export async function getWorkspaceCliSkill(id: string, workspaceId: string) {
  return db.query.workspaceCliSkills.findFirst({
    where: and(
      eq(workspaceCliSkills.id, id),
      eq(workspaceCliSkills.workspaceId, workspaceId),
    ),
  }) ?? null
}

export async function upsertWorkspaceCliSkill(
  workspaceId: string,
  input: {
    slug: string
    name: string
    description?: string | null
    sourceType: WorkspaceCliSkillRow['sourceType']
    source: string
    ref?: string | null
    computedHash?: string | null
    prompt?: string | null
    enabled?: boolean
    installedBy?: string | null
  },
) {
  const [skill] = await db
    .insert(workspaceCliSkills)
    .values({
      workspaceId,
      slug: input.slug,
      name: input.name,
      description: input.description ?? '',
      sourceType: input.sourceType,
      source: input.source,
      ref: input.ref ?? null,
      computedHash: input.computedHash ?? null,
      prompt: input.prompt ?? null,
      enabled: input.enabled ?? true,
      installedBy: input.installedBy ?? null,
    })
    .onConflictDoUpdate({
      target: [workspaceCliSkills.workspaceId, workspaceCliSkills.slug],
      set: {
        name: input.name,
        description: input.description ?? '',
        sourceType: input.sourceType,
        source: input.source,
        ref: input.ref ?? null,
        computedHash: input.computedHash ?? null,
        prompt: input.prompt ?? null,
        enabled: input.enabled ?? true,
        installedBy: input.installedBy ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  return skill
}

export async function updateWorkspaceCliSkill(
  id: string,
  workspaceId: string,
  data: Partial<{
    enabled: boolean
    prompt: string | null
  }>,
) {
  const [skill] = await db
    .update(workspaceCliSkills)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceCliSkills.id, id),
        eq(workspaceCliSkills.workspaceId, workspaceId),
      ),
    )
    .returning()

  return skill ?? null
}

export async function deleteWorkspaceCliSkill(id: string, workspaceId: string) {
  const [skill] = await db
    .delete(workspaceCliSkills)
    .where(
      and(
        eq(workspaceCliSkills.id, id),
        eq(workspaceCliSkills.workspaceId, workspaceId),
      ),
    )
    .returning()

  return skill ?? null
}
