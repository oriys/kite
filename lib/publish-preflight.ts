import { db } from './db'
import { documents, documentRelations, documentTranslations } from './schema'
import { eq, and, isNull } from 'drizzle-orm'

interface PreflightCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

interface PreflightResult {
  pass: boolean
  checks: PreflightCheck[]
}

export async function runPublishPreflight(
  documentId: string,
  workspaceId: string,
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = []

  // 1. Check document exists and has content
  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      locale: documents.locale,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )
    .limit(1)

  if (!doc) {
    return { pass: false, checks: [{ name: 'document_exists', status: 'fail', message: 'Document not found' }] }
  }

  if (!doc.content.trim()) {
    checks.push({ name: 'content_not_empty', status: 'fail', message: 'Document has no content' })
  } else {
    checks.push({ name: 'content_not_empty', status: 'pass', message: 'Document has content' })
  }

  if (!doc.title.trim()) {
    checks.push({ name: 'title_not_empty', status: 'fail', message: 'Document has no title' })
  } else {
    checks.push({ name: 'title_not_empty', status: 'pass', message: 'Document has a title' })
  }

  // 2. Check for broken internal references
  const outgoingRefs = await db
    .select({
      targetId: documentRelations.targetDocumentId,
      targetDeleted: documents.deletedAt,
    })
    .from(documentRelations)
    .leftJoin(documents, eq(documents.id, documentRelations.targetDocumentId))
    .where(
      and(
        eq(documentRelations.sourceDocumentId, documentId),
        eq(documentRelations.workspaceId, workspaceId),
      ),
    )

  const brokenRefs = outgoingRefs.filter((r) => r.targetDeleted !== null)
  if (brokenRefs.length > 0) {
    checks.push({
      name: 'broken_references',
      status: 'warn',
      message: `${brokenRefs.length} referenced document(s) have been deleted`,
    })
  } else {
    checks.push({ name: 'broken_references', status: 'pass', message: 'No broken references' })
  }

  // 3. Check translation completeness
  const translations = await db
    .select({
      locale: documentTranslations.locale,
      status: documentTranslations.status,
    })
    .from(documentTranslations)
    .where(
      and(
        eq(documentTranslations.documentId, documentId),
        isNull(documentTranslations.deletedAt),
      ),
    )

  if (translations.length > 0) {
    const incomplete = translations.filter((t) => t.status !== 'published' && t.status !== 'approved')
    if (incomplete.length > 0) {
      checks.push({
        name: 'translation_completeness',
        status: 'warn',
        message: `${incomplete.length} translation(s) not yet approved: ${incomplete.map((t) => t.locale).join(', ')}`,
      })
    } else {
      checks.push({ name: 'translation_completeness', status: 'pass', message: 'All translations approved' })
    }
  }

  // 4. Check broken links in content (simple markdown link check)
  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g
  let match: RegExpExecArray | null
  const brokenLinks: string[] = []
  while ((match = linkPattern.exec(doc.content)) !== null) {
    const href = match[2]
    if (href.startsWith('/docs/') || href.startsWith('./')) {
      // Internal link — check if referenced doc slug exists
      const slug = href.replace(/^\/docs\//, '').replace(/^\.\//, '')
      const [ref] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.workspaceId, workspaceId),
            eq(documents.slug, slug),
            isNull(documents.deletedAt),
          ),
        )
        .limit(1)

      if (!ref) {
        brokenLinks.push(href)
      }
    }
  }

  if (brokenLinks.length > 0) {
    checks.push({
      name: 'broken_links',
      status: 'warn',
      message: `${brokenLinks.length} potentially broken link(s): ${brokenLinks.slice(0, 5).join(', ')}`,
    })
  } else {
    checks.push({ name: 'broken_links', status: 'pass', message: 'No broken links detected' })
  }

  const pass = checks.every((c) => c.status !== 'fail')
  return { pass, checks }
}

export async function checkDownstreamImpact(documentId: string, workspaceId: string) {
  // Find documents that reference this document
  const downstream = await db
    .select({
      id: documentRelations.sourceDocumentId,
      title: documents.title,
      status: documents.status,
    })
    .from(documentRelations)
    .innerJoin(documents, eq(documents.id, documentRelations.sourceDocumentId))
    .where(
      and(
        eq(documentRelations.targetDocumentId, documentId),
        eq(documentRelations.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )

  // Find translations of this document
  const translations = await db
    .select({
      id: documentTranslations.id,
      locale: documentTranslations.locale,
      status: documentTranslations.status,
    })
    .from(documentTranslations)
    .where(
      and(
        eq(documentTranslations.documentId, documentId),
        isNull(documentTranslations.deletedAt),
      ),
    )

  return {
    referencingDocuments: downstream,
    translations,
    totalImpact: downstream.length + translations.length,
  }
}
