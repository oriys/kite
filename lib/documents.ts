export type DocStatus = 'draft' | 'review' | 'published' | 'archived'

export interface DocVersion {
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
  versions: DocVersion[]
}

const STORAGE_KEY = 'editorial-docs'

function generateId(): string {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function readAll(): Doc[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Doc[]) : []
  } catch {
    return []
  }
}

function writeAll(docs: Doc[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
}

function wordCount(text: string): number {
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

export const docs = {
  list(statusFilter?: DocStatus): Doc[] {
    const all = readAll()
    const filtered = statusFilter ? all.filter((d) => d.status === statusFilter) : all
    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  },

  get(id: string): Doc | undefined {
    return readAll().find((d) => d.id === id)
  },

  create(title: string, content = ''): Doc {
    const now = new Date().toISOString()
    const doc: Doc = {
      id: generateId(),
      title,
      content,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      versions: [],
    }
    const all = readAll()
    all.push(doc)
    writeAll(all)
    return doc
  },

  update(id: string, patch: Partial<Pick<Doc, 'title' | 'content'>>): Doc | undefined {
    const all = readAll()
    const idx = all.findIndex((d) => d.id === id)
    if (idx === -1) return undefined

    const doc = all[idx]
    // Save current as version before updating content
    if (patch.content !== undefined && patch.content !== doc.content) {
      doc.versions.push({
        content: doc.content,
        savedAt: doc.updatedAt,
        wordCount: wordCount(doc.content),
      })
      // Keep last 50 versions
      if (doc.versions.length > 50) {
        doc.versions = doc.versions.slice(-50)
      }
    }

    Object.assign(doc, patch, { updatedAt: new Date().toISOString() })
    all[idx] = doc
    writeAll(all)
    return doc
  },

  transition(id: string, newStatus: DocStatus): Doc | undefined {
    const all = readAll()
    const idx = all.findIndex((d) => d.id === id)
    if (idx === -1) return undefined

    all[idx].status = newStatus
    all[idx].updatedAt = new Date().toISOString()
    writeAll(all)
    return all[idx]
  },

  remove(id: string): boolean {
    const all = readAll()
    const filtered = all.filter((d) => d.id !== id)
    if (filtered.length === all.length) return false
    writeAll(filtered)
    return true
  },

  duplicate(id: string): Doc | undefined {
    const source = this.get(id)
    if (!source) return undefined
    return this.create(`${source.title} (copy)`, source.content)
  },

  wordCount,
}

export const STATUS_CONFIG: Record<DocStatus, { label: string; tone: string; next: DocStatus | null; nextLabel: string | null }> = {
  draft: { label: 'Draft', tone: 'draft', next: 'review', nextLabel: 'Submit for Review' },
  review: { label: 'In Review', tone: 'live', next: 'published', nextLabel: 'Publish' },
  published: { label: 'Published', tone: 'ready', next: 'archived', nextLabel: 'Archive' },
  archived: { label: 'Archived', tone: 'draft', next: null, nextLabel: null },
}
