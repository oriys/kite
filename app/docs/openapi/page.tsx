'use client'

import { useState, useEffect, useCallback } from 'react'
import { FeatureGuard } from '@/components/docs/feature-guard'
import { SpecUploadDialog } from '@/components/openapi/spec-upload-dialog'
import { EndpointReference } from '@/components/openapi/endpoint-reference'
import { SpecDiffViewer } from '@/components/openapi/spec-diff-viewer'
import { ChangelogPreview } from '@/components/openapi/changelog-preview'
import { TypeExportDialog } from '@/components/openapi/type-export-dialog'
import { SpecDocGenerator } from '@/components/openapi/spec-doc-generator'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, RefreshCw, Trash2, FileJson, Download, GitCompare, Clock, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface OpenApiSource {
  id: string
  name: string
  currentVersion: string | null
  sourceType: 'upload' | 'url'
  sourceUrl: string | null
  createdAt: string
  lastSyncedAt?: string | null
  updatedAt?: string | null
}

interface Endpoint {
  id: string
  path: string
  method: string
  operationId?: string | null
  summary?: string | null
  description?: string | null
  tags: string[]
  parameters: Record<string, unknown>[]
  requestBody: Record<string, unknown> | null
  responses: Record<string, unknown>
  deprecated: boolean
}

interface EndpointDiff {
  added: { path: string; method: string; summary?: string }[]
  removed: { path: string; method: string; summary?: string }[]
  changed: {
    path: string
    method: string
    changes: { field: string; from: unknown; to: unknown }[]
  }[]
}

function formatSourceTimestamp(source: OpenApiSource) {
  const rawValue = source.lastSyncedAt ?? source.updatedAt ?? source.createdAt
  if (!rawValue) return source.sourceType === 'url' ? 'Sync time unavailable' : 'Import time unavailable'

  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) {
    return source.sourceType === 'url' ? 'Sync time unavailable' : 'Import time unavailable'
  }

  return formatDistanceToNow(date, { addSuffix: true })
}

export default function OpenApiPage() {
  const [sources, setSources] = useState<OpenApiSource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Detail data for selected source
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [diff, setDiff] = useState<EndpointDiff | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/openapi')
      if (!res.ok) throw new Error('Failed to fetch sources')
      const data = await res.json()
      setSources(data)
    } catch {
      toast.error('Failed to load OpenAPI sources')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  const fetchDetails = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const [endpointsRes, diffRes] = await Promise.all([
        fetch(`/api/openapi/${id}/endpoints`),
        fetch(`/api/openapi/${id}/diff`),
      ])
      if (endpointsRes.ok) {
        const data = await endpointsRes.json()
        setEndpoints(Array.isArray(data) ? data : data.endpoints ?? [])
      }
      if (diffRes.ok) {
        setDiff(await diffRes.json())
      }
    } catch {
      toast.error('Failed to load source details')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchDetails(selectedId)
    } else {
      setEndpoints([])
      setDiff(null)
    }
  }, [selectedId, fetchDetails])

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      const res = await fetch(`/api/openapi/${id}/sync`, { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      toast.success('Spec synced successfully')
      fetchSources()
      if (selectedId === id) fetchDetails(id)
    } catch {
      toast.error('Failed to sync spec')
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/openapi/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Source deleted')
      if (selectedId === id) setSelectedId(null)
      fetchSources()
    } catch {
      toast.error('Failed to delete source')
    } finally {
      setDeletingId(null)
    }
  }

  const handleUploadSuccess = () => {
    setUploadOpen(false)
    fetchSources()
  }

  const selected = sources.find((s) => s.id === selectedId)

  if (loading) {
    return (
      <FeatureGuard featureId="openApi">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      </FeatureGuard>
    )
  }

  return (
    <FeatureGuard featureId="openApi">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            OpenAPI Sources
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Import and manage OpenAPI specifications for your workspace.
          </p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          Add Spec
        </Button>
      </div>

      {/* Empty state */}
      {sources.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileJson className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No OpenAPI sources</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Upload an OpenAPI spec file or import from a URL to get started.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setUploadOpen(true)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add your first spec
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Source cards */}
      {sources.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => {
            const isSelected = selectedId === source.id
            return (
              <Card
                key={source.id}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-accent-foreground/20 bg-accent/30'
                    : 'hover:border-border hover:bg-muted/30'
                }`}
                onClick={() => setSelectedId(isSelected ? null : source.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium leading-snug">
                      {source.name}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {source.sourceType === 'url' ? 'URL' : 'Upload'}
                    </Badge>
                  </div>
                  {source.currentVersion && (
                    <CardDescription className="text-xs">
                      v{source.currentVersion}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      {formatSourceTimestamp(source)}
                    </span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {source.sourceType === 'url' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleSync(source.id)}
                          disabled={syncingId === source.id}
                          aria-label="Sync spec"
                        >
                          <RefreshCw
                            className={`size-3.5 ${
                              syncingId === source.id ? 'animate-spin' : ''
                            }`}
                          />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(source.id)}
                        disabled={deletingId === source.id}
                        aria-label="Delete source"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail view for selected source */}
      {selected && (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {selected.name}
            </h2>
            {selected.currentVersion && (
              <Badge variant="outline" className="text-[10px]">
                v{selected.currentVersion}
              </Badge>
            )}
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="endpoints" className="space-y-4">
              <TabsList>
                <TabsTrigger value="endpoints" className="gap-1.5 text-xs">
                  <FileJson className="size-3.5" />
                  Endpoints
                </TabsTrigger>
                <TabsTrigger value="diff" className="gap-1.5 text-xs">
                  <GitCompare className="size-3.5" />
                  Diff
                </TabsTrigger>
                <TabsTrigger value="changelog" className="gap-1.5 text-xs">
                  <Clock className="size-3.5" />
                  Changelog
                </TabsTrigger>
                <TabsTrigger value="types" className="gap-1.5 text-xs">
                  <Download className="size-3.5" />
                  Types
                </TabsTrigger>
                <TabsTrigger value="generate" className="gap-1.5 text-xs">
                  <Sparkles className="size-3.5" />
                  Generate
                </TabsTrigger>
              </TabsList>

              <TabsContent value="endpoints">
                <EndpointReference endpoints={endpoints} />
              </TabsContent>

              <TabsContent value="diff">
                {diff ? (
                  <SpecDiffViewer diff={diff} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No diff data available. Upload a new version to compare.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="changelog">
                <ChangelogPreview sourceId={selected.id} />
              </TabsContent>

              <TabsContent value="types">
                <Card>
                  <CardContent className="py-6">
                    <TypeExportDialog
                      sourceId={selected.id}
                      sourceName={selected.name}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="generate">
                <SpecDocGenerator
                  sourceId={selected.id}
                  endpoints={endpoints}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}

        <SpecUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSuccess={handleUploadSuccess}
        />
      </div>
    </FeatureGuard>
  )
}
