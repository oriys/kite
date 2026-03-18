'use client'

import { useState, useCallback, type DragEvent, type ChangeEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Upload, Server, Loader2, CheckCircle2, FileCode } from 'lucide-react'
import { toast } from 'sonner'

interface ProtoUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (source: Record<string, unknown>) => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

type Mode = 'proto' | 'zip' | 'nacos' | 'etcd'

export function ProtoUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: ProtoUploadDialogProps) {
  const [mode, setMode] = useState<Mode>('proto')
  const [name, setName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Registry fields
  const [registryAddress, setRegistryAddress] = useState('')
  const [registryNamespace, setRegistryNamespace] = useState('')
  const [registryServiceName, setRegistryServiceName] = useState('')

  const reset = useCallback(() => {
    setName('')
    setSelectedFile(null)
    setIsDragOver(false)
    setIsSubmitting(false)
    setRegistryAddress('')
    setRegistryNamespace('')
    setRegistryServiceName('')
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large (max 5 MB)')
      return
    }
    setSelectedFile(file)
    setName((prev) => prev || file.name.replace(/\.(proto|zip)$/i, ''))
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name')
      return
    }

    setIsSubmitting(true)

    try {
      let res: Response

      if (mode === 'proto' || mode === 'zip') {
        if (!selectedFile) {
          toast.error(`Please upload a ${mode === 'proto' ? '.proto' : '.zip'} file`)
          setIsSubmitting(false)
          return
        }
        const formData = new FormData()
        formData.set('name', name.trim())
        formData.set('file', selectedFile)
        res = await fetch('/api/grpc', {
          method: 'POST',
          body: formData,
        })
      } else {
        if (!registryAddress.trim()) {
          toast.error('Please enter a registry address')
          setIsSubmitting(false)
          return
        }
        res = await fetch('/api/grpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            sourceType: mode,
            sourceConfig: {
              address: registryAddress.trim(),
              namespace: registryNamespace.trim() || undefined,
              serviceName: registryServiceName.trim() || undefined,
            },
          }),
        })
      }

      const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null

      if (!res.ok) {
        const error =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to create gRPC source'
        toast.error(error)
        return
      }

      if (!payload) {
        toast.error('Failed to create gRPC source')
        return
      }

      toast.success(`gRPC source "${name.trim()}" created successfully`)
      onSuccess?.(payload)
      onOpenChange(false)
      reset()
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fileAccept = mode === 'zip' ? '.zip' : '.proto'
  const fileLabel = mode === 'zip' ? '.zip' : '.proto'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import gRPC Service</DialogTitle>
          <DialogDescription>
            Upload a .proto file, a zip package, or configure a service registry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name field */}
          <div className="space-y-1.5">
            <label
              htmlFor="grpc-source-name"
              className="text-sm font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="grpc-source-name"
              placeholder="My gRPC Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Mode tabs */}
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as Mode)
              setSelectedFile(null)
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="proto" className="flex-1 gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
                Proto File
              </TabsTrigger>
              <TabsTrigger value="zip" className="flex-1 gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
                Zip Package
              </TabsTrigger>
              <TabsTrigger value="nacos" className="flex-1 gap-1.5 text-xs">
                <Server className="h-3.5 w-3.5" />
                Nacos
              </TabsTrigger>
              <TabsTrigger value="etcd" className="flex-1 gap-1.5 text-xs">
                <Server className="h-3.5 w-3.5" />
                Etcd
              </TabsTrigger>
            </TabsList>

            {/* File upload tabs */}
            {(mode === 'proto' || mode === 'zip') && (
              <TabsContent value={mode} className="mt-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragOver(true)
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 transition-colors',
                    isDragOver
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/40',
                    selectedFile && 'border-emerald-500/40 bg-emerald-500/5',
                  )}
                >
                  {selectedFile ? (
                    <>
                      <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        File loaded — ready to import
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setSelectedFile(null)}
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <>
                      <FileCode className="mb-2 h-8 w-8 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">
                        Drag &amp; drop a{' '}
                        <span className="font-medium text-foreground">
                          {fileLabel}
                        </span>{' '}
                        file here
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        or click to browse
                      </p>
                      <input
                        type="file"
                        accept={fileAccept}
                        onChange={handleFileChange}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Nacos registry */}
            <TabsContent value="nacos" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Nacos Address
                </label>
                <Input
                  placeholder="http://nacos.example.com:8848"
                  value={registryAddress}
                  onChange={(e) => setRegistryAddress(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Namespace (optional)
                </label>
                <Input
                  placeholder="public"
                  value={registryNamespace}
                  onChange={(e) => setRegistryNamespace(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Service Name (optional)
                </label>
                <Input
                  placeholder="com.example.UserService"
                  value={registryServiceName}
                  onChange={(e) => setRegistryServiceName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </TabsContent>

            {/* Etcd registry */}
            <TabsContent value="etcd" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Etcd Address
                </label>
                <Input
                  placeholder="http://etcd.example.com:2379"
                  value={registryAddress}
                  onChange={(e) => setRegistryAddress(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Service Key Prefix
                </label>
                <Input
                  placeholder="/services/grpc/"
                  value={registryServiceName}
                  onChange={(e) => setRegistryServiceName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
