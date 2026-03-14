import { NextResponse } from 'next/server'

import { embedWorkspaceDocuments } from '@/lib/embedding-pipeline'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { logServerError } from '@/lib/server-errors'

export async function POST() {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  try {
    // Ensure pgvector extension exists
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)

    // Create HNSW index if it doesn't exist
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
      ON document_chunks
      USING hnsw (embedding vector_cosine_ops)
    `)
  } catch (error) {
    logServerError('Failed to setup pgvector extension', error, {
      workspaceId: result.ctx.workspaceId,
    })
    return NextResponse.json(
      { error: 'Failed to setup vector extension. Please contact support.' },
      { status: 500 },
    )
  }

  try {
    const { processed, total } = await embedWorkspaceDocuments({
      workspaceId: result.ctx.workspaceId,
      force: false,
    })

    return NextResponse.json({
      message: `Embedded ${processed} of ${total} documents`,
      processed,
      total,
    })
  } catch (error) {
    logServerError('Embedding setup failed', error, {
      workspaceId: result.ctx.workspaceId,
    })
    return NextResponse.json(
      { error: 'Embedding generation failed. Check provider configuration.' },
      { status: 502 },
    )
  }
}
