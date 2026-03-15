import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { ssoConfigs, workspaces } from '../schema'

export type SsoConfig = typeof ssoConfigs.$inferSelect

export async function getSsoConfigs(workspaceId: string): Promise<SsoConfig[]> {
  return db
    .select()
    .from(ssoConfigs)
    .where(eq(ssoConfigs.workspaceId, workspaceId))
    .orderBy(ssoConfigs.createdAt)
}

export async function getSsoConfig(id: string): Promise<SsoConfig | undefined> {
  return db.query.ssoConfigs.findFirst({
    where: eq(ssoConfigs.id, id),
  })
}

export async function createSsoConfig(
  data: typeof ssoConfigs.$inferInsert,
): Promise<SsoConfig> {
  const [config] = await db.insert(ssoConfigs).values(data).returning()
  return config
}

export async function updateSsoConfig(
  id: string,
  data: Partial<Omit<typeof ssoConfigs.$inferInsert, 'id' | 'createdAt'>>,
): Promise<SsoConfig | undefined> {
  const [config] = await db
    .update(ssoConfigs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(ssoConfigs.id, id))
    .returning()
  return config
}

export async function deleteSsoConfig(id: string): Promise<boolean> {
  const result = await db.delete(ssoConfigs).where(eq(ssoConfigs.id, id)).returning()
  return result.length > 0
}

export async function getSsoConfigByWorkspaceSlug(
  slug: string,
): Promise<SsoConfig | undefined> {
  const rows = await db
    .select({ config: ssoConfigs })
    .from(ssoConfigs)
    .innerJoin(workspaces, eq(ssoConfigs.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaces.slug, slug),
        eq(ssoConfigs.enabled, true),
        eq(ssoConfigs.provider, 'oidc'),
      ),
    )
    .limit(1)

  return rows[0]?.config
}
