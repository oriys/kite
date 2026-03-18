import { apiRequest } from './api-client.js'

// Re-usable helpers for both CLI commands and MCP server

interface DocumentItem {
  id: string
  title: string
  slug: string
  status: string
  content: string | null
  updatedAt: string
  summary?: string
}

interface OpenapiSourceItem {
  id: string
  name: string
  openapiVersion?: string
  sourceType: string
  lastSyncedAt?: string
}

interface EndpointItem {
  method: string
  path: string
  summary?: string
  operationId?: string
  deprecated?: boolean
  tags?: string[]
}

interface SearchResult {
  documentId: string
  title: string
  slug?: string
  preview?: string
  score?: number
}

export async function fetchDocuments(opts: {
  status?: string
  limit?: number
  query?: string
} = {}): Promise<{ items: DocumentItem[]; total?: number }> {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  if (opts.limit) params.set('page_size', String(opts.limit))
  if (opts.query) params.set('q', opts.query)
  const res = await apiRequest(`/api/documents?${params}`)
  return res.json() as Promise<{ items: DocumentItem[]; total?: number }>
}

export async function fetchDocument(slugOrId: string): Promise<DocumentItem | null> {
  const data = await fetchDocuments({ query: slugOrId, limit: 50 })
  return data.items.find((d) => d.slug === slugOrId || d.id === slugOrId) || null
}

export async function fetchOpenapiSources(): Promise<{ items: OpenapiSourceItem[] }> {
  const res = await apiRequest('/api/openapi')
  return res.json() as Promise<{ items: OpenapiSourceItem[] }>
}

export async function fetchOpenapiEndpoints(sourceId: string): Promise<{ endpoints: EndpointItem[] }> {
  const res = await apiRequest(`/api/openapi/${sourceId}/endpoints`)
  return res.json() as Promise<{ endpoints: EndpointItem[] }>
}

export async function searchDocuments(query: string, limit = 10): Promise<{ results: SearchResult[] }> {
  const params = new URLSearchParams({
    q: query,
    mode: 'keyword',
    limit: String(limit),
  })
  const res = await apiRequest(`/api/search?${params}`)
  return res.json() as Promise<{ results: SearchResult[] }>
}
