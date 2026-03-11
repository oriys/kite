import { and, asc, desc, eq } from 'drizzle-orm'

import { db } from '../db'
import {
  DOC_SNIPPETS,
  normalizeDocSnippetKeywords,
  sortStoredDocSnippets,
  slugifyDocSnippetId,
  type DocSnippetMutation,
  type StoredDocSnippet,
} from '../doc-snippets'
import { docSnippets } from '../schema'

function normalizeStoredDocSnippet(
  snippet: typeof docSnippets.$inferSelect,
): StoredDocSnippet {
  return {
    id: snippet.id,
    label: snippet.label,
    description: snippet.description,
    category: snippet.category,
    keywords: snippet.keywords,
    template: snippet.template,
    workspaceId: snippet.workspaceId,
    sortOrder: snippet.sortOrder,
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString(),
  }
}

async function ensureDefaultDocSnippets(workspaceId: string) {
  const existing = await db
    .select({ id: docSnippets.id })
    .from(docSnippets)
    .where(eq(docSnippets.workspaceId, workspaceId))
    .limit(1)

  if (existing.length > 0) {
    return
  }

  await db
    .insert(docSnippets)
    .values(
      DOC_SNIPPETS.map((snippet, index) => ({
        workspaceId,
        id: snippet.id,
        label: snippet.label,
        description: snippet.description,
        category: snippet.category,
        keywords: normalizeDocSnippetKeywords(snippet.keywords),
        template: snippet.template,
        sortOrder: index + 1,
      })),
    )
    .onConflictDoNothing()
}

async function getNextSortOrder(workspaceId: string) {
  const [latest] = await db
    .select({ sortOrder: docSnippets.sortOrder })
    .from(docSnippets)
    .where(eq(docSnippets.workspaceId, workspaceId))
    .orderBy(desc(docSnippets.sortOrder))
    .limit(1)

  return (latest?.sortOrder ?? 0) + 1
}

async function generateSnippetId(workspaceId: string, label: string) {
  const baseId = slugifyDocSnippetId(label)
  let candidate = baseId
  let suffix = 2

  for (;;) {
    const existing = await getDocSnippet(candidate, workspaceId)

    if (!existing) {
      return candidate
    }

    candidate = `${baseId}-${suffix}`
    suffix += 1
  }
}

export async function listDocSnippets(workspaceId: string) {
  await ensureDefaultDocSnippets(workspaceId)

  const snippets = await db.query.docSnippets.findMany({
    where: eq(docSnippets.workspaceId, workspaceId),
    orderBy: [asc(docSnippets.sortOrder), asc(docSnippets.createdAt)],
  })

  return sortStoredDocSnippets(snippets.map(normalizeStoredDocSnippet))
}

export async function getDocSnippet(id: string, workspaceId: string) {
  const snippet = await db.query.docSnippets.findFirst({
    where: and(eq(docSnippets.workspaceId, workspaceId), eq(docSnippets.id, id)),
  })

  return snippet ? normalizeStoredDocSnippet(snippet) : null
}

export async function createDocSnippet(
  workspaceId: string,
  input: DocSnippetMutation,
) {
  await ensureDefaultDocSnippets(workspaceId)

  const id = await generateSnippetId(workspaceId, input.label)
  const sortOrder = await getNextSortOrder(workspaceId)
  const [created] = await db
    .insert(docSnippets)
    .values({
      workspaceId,
      id,
      label: input.label,
      description: input.description,
      category: input.category,
      keywords: normalizeDocSnippetKeywords(input.keywords),
      template: input.template,
      sortOrder,
    })
    .returning()

  return normalizeStoredDocSnippet(created)
}

export async function updateDocSnippet(
  id: string,
  workspaceId: string,
  patch: Partial<DocSnippetMutation>,
) {
  const updateValues: Partial<typeof docSnippets.$inferInsert> = {}

  if (patch.label !== undefined) updateValues.label = patch.label
  if (patch.description !== undefined) updateValues.description = patch.description
  if (patch.category !== undefined) updateValues.category = patch.category
  if (patch.template !== undefined) updateValues.template = patch.template
  if (patch.keywords !== undefined) {
    updateValues.keywords = normalizeDocSnippetKeywords(patch.keywords)
  }

  if (Object.keys(updateValues).length === 0) {
    return getDocSnippet(id, workspaceId)
  }

  const [updated] = await db
    .update(docSnippets)
    .set({ ...updateValues, updatedAt: new Date() })
    .where(and(eq(docSnippets.workspaceId, workspaceId), eq(docSnippets.id, id)))
    .returning()

  return updated ? normalizeStoredDocSnippet(updated) : null
}

export async function deleteDocSnippet(id: string, workspaceId: string) {
  const deleted = await db
    .delete(docSnippets)
    .where(and(eq(docSnippets.workspaceId, workspaceId), eq(docSnippets.id, id)))
    .returning({ id: docSnippets.id })

  return deleted.length > 0
}
