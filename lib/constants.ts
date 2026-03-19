import type { DocStatus } from './documents'

// ─── Document validation ────────────────────────────────────────

export const VALID_STATUSES: readonly DocStatus[] = [
  'draft',
  'review',
  'published',
  'archived',
] as const

export const MAX_TITLE_LENGTH = 255
export const MAX_DOCUMENT_CATEGORY_LENGTH = 64
export const MAX_DOCUMENT_TAG_COUNT = 20
export const MAX_DOCUMENT_TAG_LENGTH = 32
export const MAX_CONTENT_SIZE = 10 * 1024 * 1024 // 10 MB
export const DOCUMENT_PERMISSION_LEVELS = ['view', 'edit', 'manage'] as const

export const ALLOWED_TRANSITIONS: Record<DocStatus, readonly DocStatus[]> = {
  draft: ['review', 'archived'],
  review: ['draft', 'published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft'],
}

// ─── Snippet validation ─────────────────────────────────────────

export const MAX_LABEL_LENGTH = 80
export const MAX_DESCRIPTION_LENGTH = 240
export const MAX_TEMPLATE_LENGTH = 50_000
export const MAX_KEYWORD_COUNT = 16
export const MAX_KEYWORD_LENGTH = 32

// ─── Import ─────────────────────────────────────────────────────

export const MAX_IMPORT_COUNT = 200

// ─── Misc ───────────────────────────────────────────────────────

export function isValidStatus(value: string): value is DocStatus {
  return (VALID_STATUSES as readonly string[]).includes(value)
}

export function isValidDocumentPermissionLevel(
  value: string,
): value is (typeof DOCUMENT_PERMISSION_LEVELS)[number] {
  return (DOCUMENT_PERMISSION_LEVELS as readonly string[]).includes(value)
}
