const DOC_PENDING_SUMMARY_STORAGE_KEY = 'editorial-doc-pending-summary-ids'

function readPendingDocumentSummaryIds() {
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

function writePendingDocumentSummaryIds(ids: string[]) {
  if (typeof window === 'undefined') return

  try {
    if (ids.length === 0) {
      window.sessionStorage.removeItem(DOC_PENDING_SUMMARY_STORAGE_KEY)
      return
    }

    window.sessionStorage.setItem(
      DOC_PENDING_SUMMARY_STORAGE_KEY,
      JSON.stringify(ids),
    )
  } catch {}
}

export function getPendingDocumentSummaryIds() {
  return readPendingDocumentSummaryIds()
}

export function queuePendingDocumentSummary(id: string) {
  const nextIds = new Set(readPendingDocumentSummaryIds())
  nextIds.add(id)
  writePendingDocumentSummaryIds([...nextIds])
}

export function clearPendingDocumentSummary(id: string) {
  writePendingDocumentSummaryIds(
    readPendingDocumentSummaryIds().filter((queuedId) => queuedId !== id),
  )
}
