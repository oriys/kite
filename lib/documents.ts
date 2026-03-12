export type DocStatus = 'draft' | 'review' | 'published' | 'archived'
export type DocAnnotationStatus = 'open' | 'resolved'
export type DocEvaluationScore = 1 | 2 | 3 | 4 | 5

export const UNTITLED_DOCUMENT_TITLE = 'Untitled'
export const DOC_ANNOTATION_QUOTE_MAX_LENGTH = 480
export const DOC_ANNOTATION_BODY_MAX_LENGTH = 4000
export const DOC_EVALUATION_BODY_MAX_LENGTH = 2000

export interface DocActor {
  id: string | null
  name: string | null
  email: string | null
  image: string | null
}

export interface DocVersion {
  id: string
  content: string
  savedAt: string
  wordCount: number
}

export interface DocAnnotation {
  id: string
  quote: string
  body: string
  status: DocAnnotationStatus
  createdAt: string
  updatedAt: string
  createdBy: string | null
  creator: DocActor | null
}

export interface DocEvaluation {
  id: string
  score: DocEvaluationScore
  body: string
  createdAt: string
  updatedAt: string
  createdBy: string | null
  creator: DocActor | null
}

export interface Doc {
  id: string
  title: string
  content: string
  summary: string
  status: DocStatus
  createdAt: string
  updatedAt: string
  workspaceId: string
  createdBy: string | null
  versions: DocVersion[]
}

export function isDocumentTitleMissing(title: string | null | undefined) {
  const normalized = title?.trim() ?? ''
  return !normalized || normalized === UNTITLED_DOCUMENT_TITLE
}

export function isDocEvaluationScore(value: number): value is DocEvaluationScore {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

export function normalizeAnnotationQuote(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= DOC_ANNOTATION_QUOTE_MAX_LENGTH) return normalized
  return `${normalized.slice(0, DOC_ANNOTATION_QUOTE_MAX_LENGTH - 1).trimEnd()}…`
}

export function getDocEditorHref(id: string): string {
  return `/docs/editor?doc=${encodeURIComponent(id)}`
}

export const STATUS_CONFIG: Record<DocStatus, { label: string; tone: string; next: DocStatus | null; nextLabel: string | null }> = {
  draft: { label: 'Draft', tone: 'draft', next: 'review', nextLabel: 'Submit for Review' },
  review: { label: 'In Review', tone: 'live', next: 'published', nextLabel: 'Publish' },
  published: { label: 'Published', tone: 'ready', next: 'archived', nextLabel: 'Archive' },
  archived: { label: 'Archived', tone: 'draft', next: null, nextLabel: null },
}
