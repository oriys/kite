import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export interface SearchResult {
  id: string
  title: string
  headline: string
  status: string
  updatedAt: Date
  rank: number
}

/**
 * Full-text search over workspace documents.
 *
 * Uses the `search_vector` tsvector column with `ts_rank` and `ts_headline`
 * for ranking and highlighted snippets. Falls back to ILIKE on title + content
 * when the tsvector column is not yet provisioned.
 */
export async function searchDocuments(
  workspaceId: string,
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  try {
    const rows = await db.execute(
      sql`SELECT
            id,
            title,
            status,
            updated_at,
            ts_headline(
              'english',
              content,
              plainto_tsquery('english', ${query}),
              'MaxWords=35, MinWords=15, StartSel=<mark>, StopSel=</mark>'
            ) AS headline,
            ts_rank(search_vector, plainto_tsquery('english', ${query})) AS rank
          FROM documents
          WHERE workspace_id = ${workspaceId}
            AND search_vector @@ plainto_tsquery('english', ${query})
          ORDER BY rank DESC
          LIMIT ${limit}`,
    )

    return (rows as unknown as Array<Record<string, unknown>>).map(mapRow)
  } catch {
    // Fallback: search_vector column may not exist yet
    return searchDocumentsFallback(workspaceId, query, limit)
  }
}

/**
 * ILIKE fallback for when the tsvector column is unavailable.
 */
async function searchDocumentsFallback(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  const pattern = `%${query}%`
  const rows = await db.execute(
    sql`SELECT
          id,
          title,
          status,
          updated_at,
          CASE
            WHEN content ILIKE ${pattern}
              THEN substring(content from greatest(1, position(lower(${query}) in lower(content)) - 60) for 150)
            ELSE substring(content from 1 for 150)
          END AS headline,
          CASE
            WHEN title ILIKE ${pattern} THEN 2
            WHEN content ILIKE ${pattern} THEN 1
            ELSE 0
          END AS rank
        FROM documents
        WHERE workspace_id = ${workspaceId}
          AND (title ILIKE ${pattern} OR content ILIKE ${pattern})
        ORDER BY rank DESC, updated_at DESC
        LIMIT ${limit}`,
  )

  return (rows as unknown as Array<Record<string, unknown>>).map(mapRow)
}

function mapRow(row: Record<string, unknown>): SearchResult {
  return {
    id: row.id as string,
    title: row.title as string,
    headline: (row.headline as string) ?? '',
    status: row.status as string,
    updatedAt: new Date(row.updated_at as string),
    rank: Number(row.rank ?? 0),
  }
}

/**
 * One-time setup: add the tsvector column, GIN index, and auto-update trigger.
 * Safe to call multiple times (all statements are IF NOT EXISTS / OR REPLACE).
 */
export async function ensureSearchIndex(): Promise<void> {
  await db.execute(
    sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector`,
  )

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING GIN(search_vector)`,
  )

  // Auto-update trigger so every INSERT/UPDATE keeps search_vector in sync
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, ''));
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql
  `)

  await db.execute(sql`
    DROP TRIGGER IF EXISTS documents_search_vector_trigger ON documents
  `)

  await db.execute(sql`
    CREATE TRIGGER documents_search_vector_trigger
      BEFORE INSERT OR UPDATE OF title, content ON documents
      FOR EACH ROW EXECUTE FUNCTION documents_search_vector_update()
  `)

  // Back-fill existing rows that have no search_vector yet
  await db.execute(sql`
    UPDATE documents
    SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
    WHERE search_vector IS NULL
  `)
}
