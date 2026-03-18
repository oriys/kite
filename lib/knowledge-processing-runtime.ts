const activeKnowledgeSourceControllers = new Map<string, AbortController>()

export function registerKnowledgeSourceProcessing(sourceId: string) {
  const existing = activeKnowledgeSourceControllers.get(sourceId)
  if (existing) {
    existing.abort('Superseded by a newer processing run')
  }

  const controller = new AbortController()
  activeKnowledgeSourceControllers.set(sourceId, controller)
  return controller
}

export function abortKnowledgeSourceProcessing(sourceId: string, reason?: string) {
  const controller = activeKnowledgeSourceControllers.get(sourceId)
  if (!controller) return false

  if (!controller.signal.aborted) {
    controller.abort(reason ?? 'Processing stopped by user')
  }

  return true
}

export function clearKnowledgeSourceProcessing(sourceId: string, controller?: AbortController) {
  const current = activeKnowledgeSourceControllers.get(sourceId)
  if (!current) return
  if (controller && current !== controller) return

  activeKnowledgeSourceControllers.delete(sourceId)
}

export function hasActiveKnowledgeSourceProcessing(sourceId: string) {
  return activeKnowledgeSourceControllers.has(sourceId)
}
