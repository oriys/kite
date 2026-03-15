import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  documents,
  workspaceBranding,
  workspaces,
  openapiSources,
  apiEndpoints,
} from '../schema'

export async function getPublishedWorkspace(slug: string) {
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      branding: {
        logoUrl: workspaceBranding.logoUrl,
        faviconUrl: workspaceBranding.faviconUrl,
        primaryColor: workspaceBranding.primaryColor,
        accentColor: workspaceBranding.accentColor,
        customCss: workspaceBranding.customCss,
        metaTitle: workspaceBranding.metaTitle,
        metaDescription: workspaceBranding.metaDescription,
        ogImageUrl: workspaceBranding.ogImageUrl,
      },
    })
    .from(workspaces)
    .leftJoin(workspaceBranding, eq(workspaceBranding.workspaceId, workspaces.id))
    .where(eq(workspaces.slug, slug))
    .limit(1)

  if (!workspace) return null

  const [publishedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, workspace.id),
        eq(documents.status, 'published'),
        eq(documents.visibility, 'public'),
        isNull(documents.deletedAt),
      ),
    )

  if (!publishedCount || publishedCount.count === 0) return null

  return workspace
}

export type PublishedWorkspace = NonNullable<Awaited<ReturnType<typeof getPublishedWorkspace>>>

export async function getPublishedDocuments(workspaceId: string) {
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      summary: documents.summary,
      publishedSlug: documents.publishedSlug,
      slug: documents.slug,
      navSection: documents.navSection,
      publishOrder: documents.publishOrder,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        eq(documents.status, 'published'),
        eq(documents.visibility, 'public'),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(asc(documents.publishOrder), asc(documents.title))

  const sections = new Map<string, typeof docs>()
  for (const doc of docs) {
    const section = doc.navSection || 'Documentation'
    if (!sections.has(section)) sections.set(section, [])
    sections.get(section)!.push(doc)
  }

  return { docs, sections: Object.fromEntries(sections) }
}

export type PublishedDocument = Awaited<ReturnType<typeof getPublishedDocuments>>['docs'][number]

export async function getPublishedDocument(workspaceId: string, docSlug: string) {
  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      summary: documents.summary,
      publishedSlug: documents.publishedSlug,
      slug: documents.slug,
      navSection: documents.navSection,
      updatedAt: documents.updatedAt,
      category: documents.category,
    })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        eq(documents.status, 'published'),
        eq(documents.visibility, 'public'),
        isNull(documents.deletedAt),
        sql`coalesce(${documents.publishedSlug}, ${documents.slug}) = ${docSlug}`,
      ),
    )
    .limit(1)

  return doc ?? null
}

export async function getPublishedEndpoints(workspaceId: string) {
  const endpoints = await db
    .select({
      id: apiEndpoints.id,
      path: apiEndpoints.path,
      method: apiEndpoints.method,
      summary: apiEndpoints.summary,
      description: apiEndpoints.description,
      tags: apiEndpoints.tags,
      deprecated: apiEndpoints.deprecated,
      parameters: apiEndpoints.parameters,
      requestBody: apiEndpoints.requestBody,
      responses: apiEndpoints.responses,
    })
    .from(apiEndpoints)
    .innerJoin(openapiSources, eq(apiEndpoints.sourceId, openapiSources.id))
    .where(
      and(
        eq(openapiSources.workspaceId, workspaceId),
        isNull(openapiSources.deletedAt),
        eq(apiEndpoints.visibility, 'public'),
      ),
    )
    .orderBy(asc(apiEndpoints.path), asc(apiEndpoints.method))

  const byTag = new Map<string, typeof endpoints>()
  for (const ep of endpoints) {
    const tags = (ep.tags as string[] | null) ?? ['Other']
    for (const tag of tags.length ? tags : ['Other']) {
      if (!byTag.has(tag)) byTag.set(tag, [])
      byTag.get(tag)!.push(ep)
    }
  }

  return { endpoints, byTag: Object.fromEntries(byTag) }
}
