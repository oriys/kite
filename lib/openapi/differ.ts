import type { ParsedEndpoint } from './parser'

export interface EndpointDiffChange {
  field: string
  from: unknown
  to: unknown
}

export interface DiffedEndpoint {
  path: string
  method: string
  summary?: string | null
  changes?: EndpointDiffChange[]
}

export interface DiffResult {
  added: DiffedEndpoint[]
  removed: DiffedEndpoint[]
  changed: DiffedEndpoint[]
}

/**
 * Compute a semantic diff between two sets of parsed endpoints.
 * Endpoints are keyed by `METHOD /path`.
 */
export function diffEndpoints(
  previous: ParsedEndpoint[],
  current: ParsedEndpoint[],
): DiffResult {
  const key = (e: { path: string; method: string }) =>
    `${e.method} ${e.path}`

  const oldMap = new Map(previous.map((e) => [key(e), e]))
  const newMap = new Map(current.map((e) => [key(e), e]))

  const added: DiffedEndpoint[] = []
  const removed: DiffedEndpoint[] = []
  const changed: DiffedEndpoint[] = []

  // Detect removed and changed
  for (const [k, oldEp] of oldMap) {
    const newEp = newMap.get(k)
    if (!newEp) {
      removed.push({ path: oldEp.path, method: oldEp.method, summary: oldEp.summary })
      continue
    }
    const changes = compareEndpoint(oldEp, newEp)
    if (changes.length > 0) {
      changed.push({ path: oldEp.path, method: oldEp.method, summary: newEp.summary, changes })
    }
  }

  // Detect added
  for (const [k, newEp] of newMap) {
    if (!oldMap.has(k)) {
      added.push({ path: newEp.path, method: newEp.method, summary: newEp.summary })
    }
  }

  return { added, removed, changed }
}

function compareEndpoint(
  oldEp: ParsedEndpoint,
  newEp: ParsedEndpoint,
): EndpointDiffChange[] {
  const changes: EndpointDiffChange[] = []

  if (oldEp.summary !== newEp.summary) {
    changes.push({ field: 'summary', from: oldEp.summary, to: newEp.summary })
  }
  if (oldEp.description !== newEp.description) {
    changes.push({ field: 'description', from: oldEp.description, to: newEp.description })
  }
  if (oldEp.deprecated !== newEp.deprecated) {
    changes.push({ field: 'deprecated', from: oldEp.deprecated, to: newEp.deprecated })
  }

  // Parameters — compare count and names
  const oldParams = oldEp.parameters ?? []
  const newParams = newEp.parameters ?? []
  const oldParamNames = oldParams.map((p) => p.name as string).sort()
  const newParamNames = newParams.map((p) => p.name as string).sort()
  if (JSON.stringify(oldParamNames) !== JSON.stringify(newParamNames)) {
    changes.push({ field: 'parameters', from: oldParamNames, to: newParamNames })
  } else if (oldParams.length !== newParams.length) {
    changes.push({
      field: 'parameters.count',
      from: oldParams.length,
      to: newParams.length,
    })
  }

  // Request body — structural comparison
  if (!deepEqual(oldEp.requestBody, newEp.requestBody)) {
    changes.push({ field: 'requestBody', from: oldEp.requestBody, to: newEp.requestBody })
  }

  // Responses — compare status codes
  const oldCodes = Object.keys(oldEp.responses ?? {}).sort()
  const newCodes = Object.keys(newEp.responses ?? {}).sort()
  if (JSON.stringify(oldCodes) !== JSON.stringify(newCodes)) {
    changes.push({ field: 'responses', from: oldCodes, to: newCodes })
  }

  return changes
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
