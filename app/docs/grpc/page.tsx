'use client'

import { useState, useEffect, useCallback } from 'react'
import { FeatureGuard } from '@/components/docs/feature-guard'
import { ProtoUploadDialog } from '@/components/grpc/proto-upload-dialog'
import { ServiceReference } from '@/components/grpc/service-reference'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, RefreshCw, Trash2, FileCode, Clock, Network } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface GrpcSource {
  id: string
  name: string
  sourceType: 'proto_file' | 'proto_zip' | 'nacos' | 'etcd'
  sourceConfig?: Record<string, unknown> | null
  createdAt: string
  lastSyncedAt?: string | null
}

interface GrpcMethod {
  id: string
  name: string
  inputType: Record<string, unknown>
  outputType: Record<string, unknown>
  clientStreaming: boolean
  serverStreaming: boolean
}

interface GrpcService {
  id: string
  packageName: string
  serviceName: string
  description?: string | null
  methods: GrpcMethod[]
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  proto_file: 'Proto File',
  proto_zip: 'Zip Package',
  nacos: 'Nacos',
  etcd: 'Etcd',
}

function formatSourceTimestamp(source: GrpcSource) {
  const rawValue = source.lastSyncedAt ?? source.createdAt
  if (!rawValue) return 'Import time unavailable'

  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) return 'Import time unavailable'

  return formatDistanceToNow(date, { addSuffix: true })
}

export default function GrpcPage() {
  const [sources, setSources] = useState<GrpcSource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [services, setServices] = useState<GrpcService[]>([])
  const [protoContent, setProtoContent] = useState<string | undefined>()
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/grpc')
      if (!res.ok) throw new Error('Failed to fetch sources')
      const data = await res.json()
      setSources(data)
    } catch {
      toast.error('Failed to load gRPC sources')
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
      const [servicesRes, sourceRes] = await Promise.all([
        fetch(`/api/grpc/${id}/services`),
        fetch(`/api/grpc/${id}`),
      ])
      if (servicesRes.ok) {
        setServices(await servicesRes.json())
      }
      if (sourceRes.ok) {
        const sourceData = await sourceRes.json()
        // For proto_file sources, rawContent is the proto string
        if (sourceData.rawContent && sourceData.sourceType === 'proto_file') {
          setProtoContent(sourceData.rawContent)
        } else {
          setProtoContent(undefined)
        }
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
      setServices([])
      setProtoContent(undefined)
    }
  }, [selectedId, fetchDetails])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/grpc/${id}`, { method: 'DELETE' })
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
      <FeatureGuard featureId="grpc">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      </FeatureGuard>
    )
  }

  return (
    <FeatureGuard featureId="grpc">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              gRPC Services
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Import and manage gRPC service definitions for your workspace.
            </p>
          </div>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            Add Source
          </Button>
        </div>

        {/* Empty state */}
        {sources.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Network className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No gRPC sources</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Upload a .proto file, a zip package, or configure a service registry to get started.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => setUploadOpen(true)}
              >
                <Plus className="mr-1.5 size-3.5" />
                Add your first source
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
                        {SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="size-3" />
                        {formatSourceTimestamp(source)}
                      </span>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
              <Badge variant="outline" className="text-[10px]">
                {SOURCE_TYPE_LABELS[selected.sourceType] ?? selected.sourceType}
              </Badge>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="services" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="services" className="gap-1.5 text-xs">
                    <FileCode className="size-3.5" />
                    Services
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="services">
                  <ServiceReference
                    services={services}
                    protoContent={protoContent}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}

        <ProtoUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSuccess={handleUploadSuccess}
        />
      </div>
    </FeatureGuard>
  )
}
