const DOC_PENDING_SUMMARY_STORAGE_KEY = 'editorial-doc-pending-summary-ids'

function readPendingIds(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.sessionStorage.getItem(DOC_PENDING_SUMMARY_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    )
  } catch {
    return []
  }
}

function writePendingIds(ids: string[]) {
  if (typeof window === 'undefined') return

  if (ids.length === 0) {
    window.sessionStorage.removeItem(DOC_PENDING_SUMMARY_STORAGE_KEY)
    return
  }

  try {
    window.sessionStorage.setItem(
      DOC_PENDING_SUMMARY_STORAGE_KEY,
      JSON.stringify(ids),
    )
  } catch { /* storage full — silently ignore */ }
}

export function getPendingDocumentSummaryIds() {
  return readPendingIds()
}

export function queuePendingDocumentSummary(id: string) {
  const nextIds = new Set(readPendingIds())
  nextIds.add(id)
  writePendingIds([...nextIds])
}

export function clearPendingDocumentSummary(id: string) {
  writePendingIds(readPendingIds().filter((queuedId) => queuedId !== id))
}
