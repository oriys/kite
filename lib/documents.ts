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
export const MAX_DOCUMENT_SLUG_LENGTH = 80

const DOCUMENT_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/
const DOCUMENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  slug: string | null
  category: string
  tags: string[]
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

export type DocRouteTarget =
  | string
  | {
      id: string
      slug?: string | null
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
  tags: string[]
  pagination: DocumentListPagination
}

export function isDocumentTitleMissing(title: string | null | undefined) {
  const normalized = title?.trim() ?? ''
  return !normalized || normalized === UNTITLED_DOCUMENT_TITLE
}

function clampDocumentSlugLength(value: string) {
  return value.slice(0, MAX_DOCUMENT_SLUG_LENGTH).replace(/-+$/g, '') || 'document'
}

export function isDocumentIdLike(value: string | null | undefined) {
  return value ? DOCUMENT_ID_RE.test(value) : false
}

export function normalizeDocumentSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

  const baseSlug = normalized ? clampDocumentSlugLength(normalized) : 'document'
  if (!isDocumentIdLike(baseSlug)) {
    return baseSlug
  }

  return clampDocumentSlugLength(`doc-${baseSlug}`)
}

export function normalizeDocumentTags(value: readonly string[] | string | null | undefined) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/g)
      : []

  const seen = new Set<string>()

  return rawValues.reduce<string[]>((acc, item) => {
    const normalized = item.trim().toLowerCase()

    if (!normalized || seen.has(normalized)) {
      return acc
    }

    seen.add(normalized)
    acc.push(normalized)
    return acc
  }, [])
}

export function coerceDocumentTagsInput(value: unknown) {
  if (value === undefined || value === null) {
    return []
  }

  if (typeof value === 'string') {
    return normalizeDocumentTags(value)
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return normalizeDocumentTags(value)
  }

  return null
}

export function areDocumentTagsEqual(
  left: readonly string[] | string | null | undefined,
  right: readonly string[] | string | null | undefined,
) {
  const normalizedLeft = normalizeDocumentTags(left)
  const normalizedRight = normalizeDocumentTags(right)

  return (
    normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((tag, index) => tag === normalizedRight[index])
  )
}

export function isDocumentSlug(value: string | null | undefined) {
  if (!value) return false

  return (
    value.length <= MAX_DOCUMENT_SLUG_LENGTH &&
    DOCUMENT_SLUG_RE.test(value) &&
    !isDocumentIdLike(value)
  )
}

export function getDocumentIdentifier(target: DocRouteTarget) {
  if (typeof target === 'string') {
    return target
  }

  return target.slug?.trim() || target.id
}

export function isDocEditorPath(pathname: string | null | undefined) {
  return pathname === '/docs/editor' || pathname?.startsWith('/docs/editor/') || false
}

export function getDocIdentifierFromEditorLocation(
  pathname: string | null | undefined,
  searchParams?: { get(name: string): string | null } | null,
) {
  if (!isDocEditorPath(pathname)) {
    return null
  }

  const editorPathPrefix = '/docs/editor/'
  if (pathname?.startsWith(editorPathPrefix)) {
    const pathIdentifier = pathname.slice(editorPathPrefix.length)
    if (!pathIdentifier) {
      return null
    }

    try {
      return decodeURIComponent(pathIdentifier)
    } catch {
      return pathIdentifier
    }
  }

  return searchParams?.get('doc') ?? null
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

export function getDocEditorHref(
  target: DocRouteTarget,
  options: {
    translation?: string | null
    reference?: DocRouteTarget | null
  } = {},
): string {
  const params = new URLSearchParams()

  if (options.translation) {
    params.set('translation', options.translation)
  }

  if (options.reference) {
    params.set('reference', getDocumentIdentifier(options.reference))
  }

  const query = params.toString()
  return `/docs/editor/${encodeURIComponent(getDocumentIdentifier(target))}${query ? `?${query}` : ''}`
}

export const STATUS_CONFIG: Record<
  DocStatus,
  { label: string; tone: string; next: DocStatus | null; nextLabel: string | null }
> = {
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
