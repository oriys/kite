/**
 * Stub for F1 OpenAPI differ — will be replaced by the full implementation.
 */

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

export function diffEndpoints(
  previous: ParsedEndpoint[],
  current: ParsedEndpoint[],
): DiffResult {
  // Minimal stub — real implementation provided by F1
  void previous
  void current
  return { added: [], removed: [], changed: [] }
}
