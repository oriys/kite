export type DocStatus = 'draft' | 'review' | 'published' | 'archived'
export type DocumentSort =
  | 'updated_desc'
  | 'updated_asc'
  | 'created_desc'
  | 'created_asc'
  | 'title_asc'
  | 'title_desc'
export type DocPermissionLevel = 'view' | 'edit' | 'manage'
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

export interface DocPermissionAssignment {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: 'owner' | 'admin' | 'member' | 'guest'
  status: 'active' | 'disabled'
  level: DocPermissionLevel
  grantedBy: string | null
  createdAt: string
  updatedAt: string
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
  category: string
  content: string
  summary: string
  preview?: string
  wordCount?: number
  status: DocStatus
  visibility: 'public' | 'partner' | 'private'
  locale: string | null
  apiVersionId: string | null
  createdAt: string
  updatedAt: string
  workspaceId: string
  createdBy: string | null
  accessLevel: DocPermissionLevel | null
  hasCustomPermissions: boolean
  canEdit: boolean
  canManagePermissions: boolean
  canDelete: boolean
  canDuplicate: boolean
  canTransition: boolean
  versionCount?: number
  versions: DocVersion[]
}

export interface DocumentListCounts {
  all: number
  draft: number
  review: number
  published: number
  archived: number
}

export interface DocumentListPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface DocumentListResponse {
  items: Doc[]
  counts: DocumentListCounts
  categories: string[]
  pagination: DocumentListPagination
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

export const DOCUMENT_SORT_OPTIONS: Array<{ value: DocumentSort; label: string }> = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'updated_asc', label: 'Oldest updated' },
  { value: 'created_desc', label: 'Recently created' },
  { value: 'created_asc', label: 'Oldest created' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'title_desc', label: 'Title Z-A' },
]

export function isDocStatus(value: unknown): value is DocStatus {
  return value === 'draft' || value === 'review' || value === 'published' || value === 'archived'
}

export function isDocumentSort(value: unknown): value is DocumentSort {
  return DOCUMENT_SORT_OPTIONS.some((option) => option.value === value)
}

export function getStatusConfig(status: unknown) {
  return STATUS_CONFIG[isDocStatus(status) ? status : 'draft']
}

export function createEmptyDocumentCounts(): DocumentListCounts {
  return {
    all: 0,
    draft: 0,
    review: 0,
    published: 0,
    archived: 0,
  }
}
