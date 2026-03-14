import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documents, documentChunks } from '@/lib/schema'
import { chunkDocument, computeContentHash } from '@/lib/chunker'
import {
  requestAiEmbedding,
  resolveWorkspaceAiProviders,
} from '@/lib/ai-server'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import { logServerError } from '@/lib/server-errors'

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_BATCH_SIZE = 20

async function resolveEmbeddingProvider(workspaceId: string) {
  const [providers, settings] = await Promise.all([
    resolveWorkspaceAiProviders(workspaceId),
    getAiWorkspaceSettings(workspaceId),
  ])

  const embeddingModelId = settings?.embeddingModelId?.trim() || ''

  // Prefer OpenAI-compatible providers for embeddings
  const embeddingProviders = providers.filter(
    (p) => p.enabled && (p.providerType === 'openai_compatible' || p.providerType === 'gemini'),
  )

  if (embeddingProviders.length === 0) {
    return null
  }

  const provider = embeddingProviders[0]
  const modelId = embeddingModelId || DEFAULT_EMBEDDING_MODEL

  return { provider, modelId }
}

/**
 * Embed a single document: chunk it, generate embeddings, and store them.
 * Skips if the content hash hasn't changed.
 */
export async function embedDocument(input: {
  workspaceId: string
  documentId: string
  title: string
  content: string
  force?: boolean
}) {
  const contentHash = computeContentHash(input.title, input.content)

  // Check if already up-to-date
  if (!input.force) {
    const existing = await db
      .select({ contentHash: documentChunks.contentHash })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, input.documentId))
      .limit(1)

    if (existing.length > 0 && existing[0].contentHash === contentHash) {
      return { status: 'unchanged' as const, chunkCount: 0 }
    }
  }

  const resolved = await resolveEmbeddingProvider(input.workspaceId)
  if (!resolved) {
    return { status: 'no_provider' as const, chunkCount: 0 }
  }

  const chunks = chunkDocument(input.title, input.content)
  if (chunks.length === 0) {
    // Delete any existing chunks
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, input.documentId))
    return { status: 'empty' as const, chunkCount: 0 }
  }

  // Generate embeddings in batches
  const allEmbeddings: number[][] = []
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
    const result = await requestAiEmbedding({
      provider: resolved.provider,
      texts: batch.map((c) => c.embeddingText),
      model: resolved.modelId,
    })
    allEmbeddings.push(...result.embeddings)
  }

  // Replace existing chunks atomically
  await db.transaction(async (tx) => {
    await tx
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, input.documentId))

    if (chunks.length > 0) {
      await tx.insert(documentChunks).values(
        chunks.map((chunk, i) => ({
          documentId: input.documentId,
          workspaceId: input.workspaceId,
          chunkIndex: chunk.chunkIndex,
          chunkText: chunk.chunkText,
          embedding: allEmbeddings[i] ?? null,
          tokenCount: chunk.tokenCount,
          contentHash,
        })),
      )
    }
  })

  return { status: 'updated' as const, chunkCount: chunks.length }
}

/**
 * Embed all non-deleted documents in a workspace that need updating.
 */
export async function embedWorkspaceDocuments(input: {
  workspaceId: string
  force?: boolean
  onProgress?: (completed: number, total: number) => void
}) {
  const resolved = await resolveEmbeddingProvider(input.workspaceId)
  if (!resolved) {
    return { status: 'no_provider' as const, processed: 0, total: 0 }
  }

  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
    })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, input.workspaceId),
        sql`${documents.deletedAt} IS NULL`,
      ),
    )

  let processed = 0
  for (const doc of docs) {
    try {
      await embedDocument({
        workspaceId: input.workspaceId,
        documentId: doc.id,
        title: doc.title,
        content: doc.content,
        force: input.force,
      })
    } catch (error) {
      logServerError('Failed to embed document', error, {
        workspaceId: input.workspaceId,
        documentId: doc.id,
      })
    }

    processed += 1
    input.onProgress?.(processed, docs.length)
  }

  return { status: 'done' as const, processed, total: docs.length }
}

/**
 * Check embedding coverage for a workspace.
 */
export async function getEmbeddingStatus(workspaceId: string) {
  const [docCountResult, chunkCountResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, workspaceId),
          sql`${documents.deletedAt} IS NULL`,
        ),
      ),
    db
      .select({
        docCount: sql<number>`count(distinct ${documentChunks.documentId})`,
        chunkCount: sql<number>`count(*)`,
      })
      .from(documentChunks)
      .where(eq(documentChunks.workspaceId, workspaceId)),
  ])

  const totalDocs = Number(docCountResult[0]?.count ?? 0)
  const embeddedDocs = Number(chunkCountResult[0]?.docCount ?? 0)
  const totalChunks = Number(chunkCountResult[0]?.chunkCount ?? 0)

  return {
    totalDocuments: totalDocs,
    embeddedDocuments: embeddedDocs,
    totalChunks,
    coverage: totalDocs > 0 ? embeddedDocs / totalDocs : 0,
  }
}
