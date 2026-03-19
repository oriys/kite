import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { knowledgeSources, documentChunks } from '@/lib/schema'
import { chunkDocument, computeContentHash } from '@/lib/chunker'
import {
  requestAiEmbedding,
  resolveEmbeddingProvider,
} from '@/lib/ai-server'
import { extractZipDocuments } from '@/lib/knowledge-extractors'
import { logServerError } from '@/lib/server-errors'
import { EMBEDDING_BATCH_SIZE } from '@/lib/ai-config'
import { insertDocumentChunkRowsInBatches } from '@/lib/document-chunk-storage'
import {
  clearKnowledgeSourceProcessing,
  registerKnowledgeSourceProcessing,
} from '@/lib/knowledge-processing-runtime'
import {
  extractKnowledgeSourceContent,
  type ExtractableKnowledgeSourceType,
} from '@/lib/knowledge-source-content'
import {
  deriveTitleFromUrl,
  fetchPublicUrlContent,
} from '@/lib/public-url-content'
import { sanitizePlainText } from '@/lib/sanitize'

const MAX_KNOWLEDGE_SOURCE_ERROR_MESSAGE_LENGTH = 500
const ZIP_CHUNK_PROGRESS_INTERVAL = 50
const ZIP_DOCUMENT_CHUNK_INSERT_BATCH_SIZE = 50
const URL_CONTENT_FETCH_TIMEOUT_MS = 30_000
const MAX_URL_CONTENT_CHARS = 2_000_000

export class KnowledgeSourceProcessingStoppedError extends Error {
  constructor(message = 'Processing stopped by user') {
    super(message)
    this.name = 'KnowledgeSourceProcessingStoppedError'
  }
}

function formatKnowledgeSourceProcessingErrorMessage(error: unknown) {
  const messages: string[] = []

  if (error instanceof Error) {
    const cause = error.cause
    if (cause instanceof Error) {
      messages.push(cause.message)
    } else if (typeof cause === 'string') {
      messages.push(cause)
    }
    messages.push(error.message)
  } else if (typeof error === 'string') {
    messages.push(error)
  }

  const normalizedMessages = messages
    .map((message) => sanitizePlainText(message).trim())
    .filter((message) => message.length > 0)
  const preferredMessage =
    normalizedMessages.find((message) => !message.startsWith('Failed query:'))
    ?? normalizedMessages[0]

  return preferredMessage
    ? preferredMessage.slice(0, MAX_KNOWLEDGE_SOURCE_ERROR_MESSAGE_LENGTH)
    : 'Processing failed'
}

/**
 * Process a single knowledge source: extract text, chunk, embed, store.
 */
export async function processKnowledgeSource(input: {
  knowledgeSourceId: string
  workspaceId: string
}) {
  const runtimeController = registerKnowledgeSourceProcessing(input.knowledgeSourceId)

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
    clearKnowledgeSourceProcessing(input.knowledgeSourceId, runtimeController)
    throw new Error('Knowledge source not found')
  }

  // Preserve user metadata, strip any stale _processing key
  const userMetadata = {
    ...((source.metadata ?? {}) as Record<string, unknown> & { _processing?: unknown }),
  }
  delete userMetadata._processing

  function throwIfAborted() {
    if (!runtimeController.signal.aborted) return

    const reason =
      typeof runtimeController.signal.reason === 'string'
        ? runtimeController.signal.reason
        : 'Processing stopped by user'
    throw new KnowledgeSourceProcessingStoppedError(reason)
  }

  async function throwIfStopRequested() {
    throwIfAborted()

    const [current] = await db
      .select({
        status: knowledgeSources.status,
        stopRequestedAt: knowledgeSources.stopRequestedAt,
        deletedAt: knowledgeSources.deletedAt,
      })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, source.id))
      .limit(1)

    if (!current || current.deletedAt || current.status === 'archived') {
      throw new KnowledgeSourceProcessingStoppedError(
        'Knowledge source was removed during processing',
      )
    }

    if (current.stopRequestedAt) {
      throw new KnowledgeSourceProcessingStoppedError()
    }
  }

  async function wasSourceRemovedDuringProcessing() {
    const [current] = await db
      .select({
        status: knowledgeSources.status,
        deletedAt: knowledgeSources.deletedAt,
      })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, source.id))
      .limit(1)

    return !current || current.deletedAt || current.status === 'archived'
  }

  async function writeProgress(progress: number, stage: string, detail?: string) {
    await throwIfStopRequested()

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

  try {
    // Mark as processing with initial progress
    await db
      .update(knowledgeSources)
      .set({
        status: 'processing',
        stopRequestedAt: null,
        metadata: { ...userMetadata, _processing: { progress: 0, stage: 'starting' } },
        updatedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(knowledgeSources.id, source.id))

    await throwIfStopRequested()

    const resolved = await resolveEmbeddingProvider(input.workspaceId)
    if (!resolved) {
      throw new Error('No embedding provider configured')
    }

    let sourceRawContent = source.rawContent
    let fetchedUrlTitle = ''
    const normalizedSourceUrl = source.sourceUrl?.trim() ?? ''
    if (source.sourceType === 'url') {
      if (!normalizedSourceUrl) {
        throw new Error('URL knowledge source requires a source URL')
      }

      await writeProgress(0.05, 'extracting', 'Fetching URL content')
      const fetched = await fetchPublicUrlContent(normalizedSourceUrl, {
        timeoutMs: URL_CONTENT_FETCH_TIMEOUT_MS,
        maxChars: MAX_URL_CONTENT_CHARS,
      })
      sourceRawContent = fetched.rawContent
      fetchedUrlTitle = sanitizePlainText(fetched.title).trim()
      userMetadata.lastFetchedAt = new Date().toISOString()
      if (fetched.contentType) {
        userMetadata.fetchedContentType = fetched.contentType
      }
    } else {
      await writeProgress(0.05, 'extracting')
    }

    let title = source.title || 'Untitled'
    let contentHash = computeContentHash(title, sourceRawContent)
    let chunks: ReturnType<typeof chunkDocument> = []

    if (source.sourceType === 'zip') {
      const extractedDocuments = extractZipDocuments(sourceRawContent)
      title = source.title || 'Zip Archive'
      contentHash = computeContentHash(title, sourceRawContent)

      await writeProgress(
        0.15,
        'chunking',
        extractedDocuments.length > 0 ? `0 / ${extractedDocuments.length}` : undefined,
      )

      let nextChunkIndex = 0
      for (const [index, document] of extractedDocuments.entries()) {
        await throwIfStopRequested()

        const documentChunks = chunkDocument(
          `${title} — ${document.path}`,
          document.content,
        )

        for (const chunk of documentChunks) {
          chunks.push({
            ...chunk,
            chunkIndex: nextChunkIndex,
            sectionPath: chunk.sectionPath
              ? `${document.path} > ${chunk.sectionPath}`
              : document.path,
          })
          nextChunkIndex += 1
        }

        const completed = index + 1
        if (
          completed === extractedDocuments.length ||
          completed % ZIP_CHUNK_PROGRESS_INTERVAL === 0
        ) {
          await writeProgress(
            0.15 + (0.05 * completed / Math.max(extractedDocuments.length, 1)),
            'chunking',
            `${completed} / ${extractedDocuments.length}`,
          )
        }
      }
    } else {
      const { title: extractedTitle, content } = await extractKnowledgeSourceContent(
        source.sourceType as ExtractableKnowledgeSourceType,
        sourceRawContent,
      )
      const normalizedContent = sanitizePlainText(content)
      const normalizedExtractedTitle = sanitizePlainText(extractedTitle).trim()
      const existingTitle = sanitizePlainText(source.title).trim()
      const shouldReplaceGeneratedTitle =
        source.sourceType === 'url'
        && (userMetadata.generatedTitleFromUrl === true || existingTitle.length === 0)
      title = shouldReplaceGeneratedTitle
        ? normalizedExtractedTitle
          || fetchedUrlTitle
          || deriveTitleFromUrl(normalizedSourceUrl).trim()
          || existingTitle
          || 'Untitled'
        : existingTitle || normalizedExtractedTitle || fetchedUrlTitle || 'Untitled'
      contentHash = computeContentHash(title, normalizedContent)

      await writeProgress(0.15, 'chunking')
      chunks = chunkDocument(title, normalizedContent)
    }

    await throwIfStopRequested()

    if (chunks.length === 0) {
      await db
        .delete(documentChunks)
        .where(
          eq(documentChunks.knowledgeSourceId, source.id),
        )

      await db
        .update(knowledgeSources)
        .set({
          title,
          rawContent: sourceRawContent,
          status: 'ready',
          contentHash,
          metadata: userMetadata,
          stopRequestedAt: null,
          processedAt: new Date(),
          updatedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(knowledgeSources.id, source.id))

      return { status: 'ready' as const, chunkCount: 0 }
    }

    // Generate embeddings in batches
    const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)
    const allEmbeddings: number[][] = []
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      await throwIfStopRequested()

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
        abortSignal: runtimeController.signal,
      })
      allEmbeddings.push(...result.embeddings)
      if (result.embeddings.length !== batch.length) {
        throw new Error(
          `Embedding count mismatch: expected ${batch.length}, got ${result.embeddings.length}`,
        )
      }
    }

    await writeProgress(0.9, 'storing')
    await throwIfStopRequested()

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

      await insertDocumentChunkRowsInBatches(
        tx,
        chunkRows,
        source.sourceType === 'zip'
          ? ZIP_DOCUMENT_CHUNK_INSERT_BATCH_SIZE
          : undefined,
      )
    })

    await db
      .update(knowledgeSources)
      .set({
        title,
        rawContent: sourceRawContent,
        status: 'ready',
        contentHash,
        metadata: userMetadata,
        stopRequestedAt: null,
        processedAt: new Date(),
        updatedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(knowledgeSources.id, source.id))

    return { status: 'ready' as const, chunkCount: chunks.length }
  } catch (error) {
    if (await wasSourceRemovedDuringProcessing()) {
      return { status: 'cancelled' as const, chunkCount: 0 }
    }

    if (
      error instanceof KnowledgeSourceProcessingStoppedError ||
      runtimeController.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      await db
        .update(knowledgeSources)
        .set({
          status: 'cancelled',
          metadata: userMetadata,
          stopRequestedAt: null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSources.id, source.id))

      return { status: 'cancelled' as const, chunkCount: 0 }
    }

    const message = formatKnowledgeSourceProcessingErrorMessage(error)

    await db
      .update(knowledgeSources)
      .set({
        status: 'error',
        metadata: userMetadata,
        stopRequestedAt: null,
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, source.id))

    logServerError('Knowledge source processing failed', error, {
      knowledgeSourceId: input.knowledgeSourceId,
      workspaceId: input.workspaceId,
    })

    throw error
  } finally {
    clearKnowledgeSourceProcessing(input.knowledgeSourceId, runtimeController)
  }
}
