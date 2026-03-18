import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeSources, documentChunks } from '@/lib/schema'
import { chunkDocument, computeContentHash } from '@/lib/chunker'
import {
  requestAiEmbedding,
  resolveEmbeddingProvider,
} from '@/lib/ai-server'
import { logServerError } from '@/lib/server-errors'
import { EMBEDDING_BATCH_SIZE } from '@/lib/ai-config'
import { insertDocumentChunkRowsInBatches } from '@/lib/document-chunk-storage'
import {
  extractOpenApiContent,
  extractGraphQlContent,
  extractZipContent,
  extractAsyncApiContent,
  extractProtobufContent,
  extractRstContent,
  extractAsciidocContent,
  extractCsvContent,
  extractSqlDdlContent,
  extractTypeScriptDefsContent,
  extractPostmanContent,
} from '@/lib/knowledge-extractors'

/**
 * Extract plain text from raw content based on source type.
 */
async function extractContent(
  sourceType: string,
  rawContent: string,
): Promise<{ title: string; content: string }> {
  switch (sourceType) {
    case 'openapi':
      return await extractOpenApiContent(rawContent)
    case 'graphql':
      return extractGraphQlContent(rawContent)
    case 'zip':
      return extractZipContent(rawContent)
    case 'asyncapi':
      return extractAsyncApiContent(rawContent)
    case 'protobuf':
      return extractProtobufContent(rawContent)
    case 'rst':
      return extractRstContent(rawContent)
    case 'asciidoc':
      return extractAsciidocContent(rawContent)
    case 'csv':
      return extractCsvContent(rawContent)
    case 'sql_ddl':
      return extractSqlDdlContent(rawContent)
    case 'typescript_defs':
      return extractTypeScriptDefsContent(rawContent)
    case 'postman':
      return extractPostmanContent(rawContent)
    case 'faq': {
      // Expect JSON array of { question, answer } pairs
      try {
        const pairs = JSON.parse(rawContent) as Array<{
          question: string
          answer: string
        }>
        const content = pairs
          .map((p) => `## ${p.question}\n\n${p.answer}`)
          .join('\n\n')
        return { title: 'FAQ', content }
      } catch {
        return { title: 'FAQ', content: rawContent }
      }
    }
    case 'url':
    case 'pdf':
    case 'markdown':
    case 'document':
    default:
      return { title: '', content: rawContent }
  }
}

/**
 * Process a single knowledge source: extract text, chunk, embed, store.
 */
export async function processKnowledgeSource(input: {
  knowledgeSourceId: string
  workspaceId: string
}) {
  const [source] = await db
    .select()
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, input.knowledgeSourceId),
        eq(knowledgeSources.workspaceId, input.workspaceId),
      ),
    )
    .limit(1)

  if (!source) {
    throw new Error('Knowledge source not found')
  }

  // Preserve user metadata, strip any stale _processing key
  const userMetadata = {
    ...((source.metadata ?? {}) as Record<string, unknown> & { _processing?: unknown }),
  }
  delete userMetadata._processing

  async function writeProgress(progress: number, stage: string, detail?: string) {
    await db
      .update(knowledgeSources)
      .set({
        metadata: {
          ...userMetadata,
          _processing: { progress, stage, ...(detail ? { detail } : {}) },
        },
      })
      .where(eq(knowledgeSources.id, source.id))
  }

  // Mark as processing with initial progress
  await db
    .update(knowledgeSources)
    .set({
      status: 'processing',
      metadata: { ...userMetadata, _processing: { progress: 0, stage: 'starting' } },
      updatedAt: new Date(),
    })
    .where(eq(knowledgeSources.id, source.id))

  try {
    const resolved = await resolveEmbeddingProvider(input.workspaceId)
    if (!resolved) {
      throw new Error('No embedding provider configured')
    }

    await writeProgress(0.05, 'extracting')
    const { title: extractedTitle, content } = await extractContent(
      source.sourceType,
      source.rawContent,
    )
    const title = source.title || extractedTitle || 'Untitled'
    const contentHash = computeContentHash(title, content)

    await writeProgress(0.15, 'chunking')
    const chunks = chunkDocument(title, content)
    if (chunks.length === 0) {
      await db
        .delete(documentChunks)
        .where(
          eq(documentChunks.knowledgeSourceId, source.id),
        )

      await db
        .update(knowledgeSources)
        .set({
          status: 'ready',
          contentHash,
          metadata: userMetadata,
          processedAt: new Date(),
          updatedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(knowledgeSources.id, source.id))

      return { status: 'empty' as const, chunkCount: 0 }
    }

    // Generate embeddings in batches
    const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)
    const allEmbeddings: number[][] = []
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batchIndex = Math.floor(i / EMBEDDING_BATCH_SIZE)
      await writeProgress(
        0.2 + (0.65 * batchIndex / totalBatches),
        'embedding',
        `${batchIndex + 1} / ${totalBatches}`,
      )
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

    await writeProgress(0.9, 'storing')

    const chunkRows = chunks.map((chunk, i) => ({
      workspaceId: input.workspaceId,
      documentId: null,
      knowledgeSourceId: source.id,
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
        .where(
          eq(documentChunks.knowledgeSourceId, source.id),
        )

      await insertDocumentChunkRowsInBatches(tx, chunkRows)
    })

    await db
      .update(knowledgeSources)
      .set({
        status: 'ready',
        contentHash,
        metadata: userMetadata,
        processedAt: new Date(),
        updatedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(knowledgeSources.id, source.id))

    return { status: 'processed' as const, chunkCount: chunks.length }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Processing failed'

    await db
      .update(knowledgeSources)
      .set({
        status: 'error',
        metadata: userMetadata,
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, source.id))

    logServerError('Knowledge source processing failed', error, {
      knowledgeSourceId: input.knowledgeSourceId,
      workspaceId: input.workspaceId,
    })

    throw error
  }
}
