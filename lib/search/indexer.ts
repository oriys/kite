import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/**
 * Strip HTML tags and Markdown syntax from content to produce
 * plain text suitable for full-text indexing.
 */
export function stripMarkdownAndHtml(content: string): string {
  let text = content

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ')

  // Remove fenced code blocks (``` ... ```)
  text = text.replace(/```[\s\S]*?```/g, ' ')

  // Remove inline code
  text = text.replace(/`[^`]*`/g, ' ')

  // Remove images ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')

  // Convert links [text](url) → text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')

  // Remove headings markers
  text = text.replace(/^#{1,6}\s+/gm, '')

  // Remove bold/italic markers
  text = text.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')

  // Remove strikethrough
  text = text.replace(/~~(.*?)~~/g, '$1')

  // Remove blockquotes
  text = text.replace(/^>\s+/gm, '')

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '')

  // Remove list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '')
  text = text.replace(/^[\s]*\d+\.\s+/gm, '')

  // Remove HTML entities
  text = text.replace(/&[a-zA-Z]+;/g, ' ')
  text = text.replace(/&#\d+;/g, ' ')

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

/**
 * Update the search_vector column for a single document.
 * Uses raw SQL since tsvector is not in the Drizzle schema.
 */
export async function updateSearchIndex(
  documentId: string,
  title: string,
  content: string,
): Promise<void> {
  const plainContent = stripMarkdownAndHtml(content)
  await db.execute(
    sql`UPDATE documents SET search_vector = to_tsvector('english', ${title} || ' ' || ${plainContent}) WHERE id = ${documentId} AND deleted_at IS NULL`,
  )
}
