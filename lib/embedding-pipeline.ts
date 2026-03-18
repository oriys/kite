import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documents, documentChunks } from '@/lib/schema'
import { chunkDocument, computeContentHash } from '@/lib/chunker'
import {
  requestAiEmbedding,
  resolveEmbeddingProvider,
} from '@/lib/ai-server'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import { insertDocumentChunkRowsInBatches } from '@/lib/document-chunk-storage'
import { logServerError } from '@/lib/server-errors'
import { EMBEDDING_BATCH_SIZE } from '@/lib/ai-config'

/**
 * Embed a single document: chunk it, generate embeddings, and store them.
 * Skips if the content hash hasn't changed.
 * If ragEnabled is false, deletes existing chunks and returns skipped.
 */
export async function embedDocument(input: {
  workspaceId: string
  documentId: string
  title: string
  content: string
  force?: boolean
  ragEnabled?: boolean
}) {
  // If RAG is explicitly disabled for this document, delete existing chunks
  if (input.ragEnabled === false) {
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, input.documentId))
    return { status: 'skipped' as const, chunkCount: 0 }
  }

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
    if (result.embeddings.length !== batch.length) {
      throw new Error(
        `Embedding count mismatch: expected ${batch.length}, got ${result.embeddings.length}`,
      )
    }
  }

  const chunkRows = chunks.map((chunk, i) => ({
    documentId: input.documentId,
    workspaceId: input.workspaceId,
    chunkIndex: chunk.chunkIndex,
    chunkText: chunk.chunkText,
    sectionPath: chunk.sectionPath,
    heading: chunk.heading,
    embedding: allEmbeddings[i] ?? null,
    tokenCount: chunk.tokenCount,
    contentHash,
  }))

  // Replace existing chunks atomically
  await db.transaction(async (tx) => {
    await tx
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, input.documentId))

    await insertDocumentChunkRowsInBatches(tx, chunkRows)
  })

  return { status: 'updated' as const, chunkCount: chunks.length }
}

/**
 * Embed all non-deleted documents in a workspace that need updating.
 * Respects global RAG toggle and per-document RAG flags.
 */
export async function embedWorkspaceDocuments(input: {
  workspaceId: string
  force?: boolean
  onProgress?: (completed: number, total: number) => void
}) {
  // Check global RAG setting first
  const settings = await getAiWorkspaceSettings(input.workspaceId)
  if (settings?.ragEnabled === false) {
    return { status: 'rag_disabled' as const, processed: 0, total: 0 }
  }

  const resolved = await resolveEmbeddingProvider(input.workspaceId)
  if (!resolved) {
    return { status: 'no_provider' as const, processed: 0, total: 0 }
  }

  const allDocs: Array<{ id: string; title: string; content: string; ragEnabled: boolean }> = []
  let batchOffset = 0
  const batchSize = 100
  while (true) {
    const batch = await db
      .select({
        id: documents.id,
        title: documents.title,
        content: documents.content,
        ragEnabled: documents.ragEnabled,
      })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, input.workspaceId),
          sql`${documents.deletedAt} IS NULL`,
        ),
      )
      .limit(batchSize)
      .offset(batchOffset)
    allDocs.push(...batch)
    if (batch.length < batchSize) break
    batchOffset += batchSize
  }

  let processed = 0
  for (const doc of allDocs) {
    try {
      await embedDocument({
        workspaceId: input.workspaceId,
        documentId: doc.id,
        title: doc.title,
        content: doc.content,
        force: input.force,
        ragEnabled: doc.ragEnabled,
      })
    } catch (error) {
      logServerError('Failed to embed document', error, {
        workspaceId: input.workspaceId,
        documentId: doc.id,
      })
    }

    processed += 1
    input.onProgress?.(processed, allDocs.length)
  }

  return { status: 'done' as const, processed, total: allDocs.length }
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
