import { describe, expect, it, vi } from 'vitest'

import { documentChunks } from '@/lib/schema'
import {
  DOCUMENT_CHUNK_INSERT_BATCH_SIZE,
  insertDocumentChunkRowsInBatches,
  type DocumentChunkInsert,
} from '../document-chunk-storage'

function createChunkRow(chunkIndex: number): DocumentChunkInsert {
  return {
    workspaceId: 'ws_123',
    documentId: 'doc_123',
    chunkIndex,
    chunkText: `Chunk ${chunkIndex}`,
    sectionPath: null,
    heading: null,
    knowledgeSourceId: null,
    embedding: null,
    tokenCount: 32,
    contentHash: 'hash_123',
  }
}

describe('insertDocumentChunkRowsInBatches', () => {
  it('splits large inserts into smaller batches while preserving row order', async () => {
    const insertSpy = vi.fn<
      (table: typeof documentChunks) => {
        values: (rows: DocumentChunkInsert[]) => Promise<void>
      }
    >(() => ({
      values: async (rows) => {
        void rows
      },
    }))

    const valuesSpy = vi.fn(async (rows: DocumentChunkInsert[]) => {
      void rows
    })
    insertSpy.mockReturnValue({ values: valuesSpy })

    const rows = Array.from(
      { length: DOCUMENT_CHUNK_INSERT_BATCH_SIZE * 2 + 1 },
      (_, index) => createChunkRow(index),
    )

    await insertDocumentChunkRowsInBatches({ insert: insertSpy }, rows)

    expect(insertSpy).toHaveBeenCalledTimes(3)
    expect(insertSpy).toHaveBeenNthCalledWith(1, documentChunks)
    expect(valuesSpy.mock.calls.map(([batch]) => batch.length)).toEqual([
      DOCUMENT_CHUNK_INSERT_BATCH_SIZE,
      DOCUMENT_CHUNK_INSERT_BATCH_SIZE,
      1,
    ])
    expect(valuesSpy.mock.calls.flatMap(([batch]) => batch.map((row) => row.chunkIndex))).toEqual(
      rows.map((row) => row.chunkIndex),
    )
  })

  it('skips insert calls when there are no rows', async () => {
    const insertSpy = vi.fn()

    await insertDocumentChunkRowsInBatches(
      {
        insert: insertSpy,
      },
      [],
    )

    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('rejects invalid batch sizes', async () => {
    await expect(
      insertDocumentChunkRowsInBatches(
        {
          insert: vi.fn(() => ({
            values: async () => undefined,
          })),
        },
        [createChunkRow(0)],
        0,
      ),
    ).rejects.toThrow('Document chunk insert batch size must be a positive integer')
  })
})
