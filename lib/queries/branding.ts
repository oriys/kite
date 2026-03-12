import { eq } from 'drizzle-orm'
import { db } from '../db'
import { workspaceBranding } from '../schema'

export async function getWorkspaceBranding(workspaceId: string) {
  return (
    (await db.query.workspaceBranding.findFirst({
      where: eq(workspaceBranding.workspaceId, workspaceId),
    })) ?? null
  )
}

export async function upsertWorkspaceBranding(
  workspaceId: string,
  data: Partial<{
    logoUrl: string | null
    faviconUrl: string | null
    primaryColor: string | null
    accentColor: string | null
    customDomain: string | null
    customCss: string | null
    metaTitle: string | null
    metaDescription: string | null
    ogImageUrl: string | null
  }>,
) {
  const [result] = await db
    .insert(workspaceBranding)
    .values({ workspaceId, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: workspaceBranding.workspaceId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning()
  return result
}
