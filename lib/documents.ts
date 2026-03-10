export type DocStatus = 'draft' | 'review' | 'published' | 'archived'

export interface DocVersion {
  id: string
  content: string
  savedAt: string
  wordCount: number
}

export interface Doc {
  id: string
  title: string
  content: string
  status: DocStatus
  createdAt: string
  updatedAt: string
  workspaceId: string
  createdBy: string | null
  versions: DocVersion[]
}

export function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  // Handle both CJK and latin text
  const cjk = trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length ?? 0
  const latin = trimmed
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, '')
    .split(/\s+/)
    .filter(Boolean).length
  return cjk + latin
}

export const STATUS_CONFIG: Record<DocStatus, { label: string; tone: string; next: DocStatus | null; nextLabel: string | null }> = {
  draft: { label: 'Draft', tone: 'draft', next: 'review', nextLabel: 'Submit for Review' },
  review: { label: 'In Review', tone: 'live', next: 'published', nextLabel: 'Publish' },
  published: { label: 'Published', tone: 'ready', next: 'archived', nextLabel: 'Archive' },
  archived: { label: 'Archived', tone: 'draft', next: null, nextLabel: null },
}
