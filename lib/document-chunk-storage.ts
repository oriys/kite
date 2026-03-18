import { documentChunks } from '@/lib/schema'

export const DOCUMENT_CHUNK_INSERT_BATCH_SIZE = 200

export type DocumentChunkInsert = typeof documentChunks.$inferInsert

type DocumentChunkInsertExecutor = {
  insert: (table: typeof documentChunks) => {
    values: (rows: DocumentChunkInsert[]) => PromiseLike<unknown>
  }
}

export async function insertDocumentChunkRowsInBatches(
  executor: DocumentChunkInsertExecutor,
  rows: readonly DocumentChunkInsert[],
  batchSize = DOCUMENT_CHUNK_INSERT_BATCH_SIZE,
) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Document chunk insert batch size must be a positive integer')
  }

  for (let i = 0; i < rows.length; i += batchSize) {
    await executor.insert(documentChunks).values(rows.slice(i, i + batchSize))
  }
}
