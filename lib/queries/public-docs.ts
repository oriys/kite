import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  publishedSnapshots,
  publishedTranslationSnapshots,
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
    .from(publishedSnapshots)
    .where(
      and(
        eq(publishedSnapshots.workspaceId, workspace.id),
        eq(publishedSnapshots.isActive, true),
        eq(publishedSnapshots.visibility, 'public'),
      ),
    )

  if (!publishedCount || publishedCount.count === 0) return null

  return workspace
}

export type PublishedWorkspace = NonNullable<Awaited<ReturnType<typeof getPublishedWorkspace>>>

export async function getPublishedDocuments(workspaceId: string) {
  const docs = await db
    .select({
      id: publishedSnapshots.documentId,
      title: publishedSnapshots.title,
      summary: publishedSnapshots.summary,
      publishedSlug: publishedSnapshots.publishedSlug,
      slug: publishedSnapshots.slug,
      navSection: publishedSnapshots.navSection,
      publishOrder: publishedSnapshots.publishOrder,
      updatedAt: publishedSnapshots.publishedAt,
    })
    .from(publishedSnapshots)
    .where(
      and(
        eq(publishedSnapshots.workspaceId, workspaceId),
        eq(publishedSnapshots.isActive, true),
        eq(publishedSnapshots.visibility, 'public'),
      ),
    )
    .orderBy(asc(publishedSnapshots.publishOrder), asc(publishedSnapshots.title))

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
      id: publishedSnapshots.documentId,
      title: publishedSnapshots.title,
      content: publishedSnapshots.content,
      summary: publishedSnapshots.summary,
      publishedSlug: publishedSnapshots.publishedSlug,
      slug: publishedSnapshots.slug,
      navSection: publishedSnapshots.navSection,
      updatedAt: publishedSnapshots.publishedAt,
      category: publishedSnapshots.category,
    })
    .from(publishedSnapshots)
    .where(
      and(
        eq(publishedSnapshots.workspaceId, workspaceId),
        eq(publishedSnapshots.isActive, true),
        eq(publishedSnapshots.visibility, 'public'),
        sql`coalesce(${publishedSnapshots.publishedSlug}, ${publishedSnapshots.slug}) = ${docSlug}`,
      ),
    )
    .limit(1)

  return doc ?? null
}

export async function getPublishedDocumentByLocale(
  workspaceId: string,
  docSlug: string,
  locale: string,
) {
  // First get the base document to find its ID
  const baseDoc = await getPublishedDocument(workspaceId, docSlug)
  if (!baseDoc) return null

  if (locale === 'en') return baseDoc

  const [translation] = await db
    .select({
      id: publishedTranslationSnapshots.documentId,
      title: publishedTranslationSnapshots.title,
      content: publishedTranslationSnapshots.content,
      locale: publishedTranslationSnapshots.locale,
      updatedAt: publishedTranslationSnapshots.publishedAt,
    })
    .from(publishedTranslationSnapshots)
    .where(
      and(
        eq(publishedTranslationSnapshots.workspaceId, workspaceId),
        eq(publishedTranslationSnapshots.documentId, baseDoc.id),
        eq(publishedTranslationSnapshots.locale, locale),
        eq(publishedTranslationSnapshots.isActive, true),
      ),
    )
    .limit(1)

  if (!translation) return baseDoc

  return {
    ...baseDoc,
    title: translation.title,
    content: translation.content,
    updatedAt: translation.updatedAt,
  }
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
        sql`${openapiSources.deletedAt} is null`,
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
