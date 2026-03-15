'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  Eye,
  RefreshCw,
  FileCode2,
  FolderTree,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'

type SdkLanguage = 'typescript' | 'python' | 'go'

interface Props {
  openapiSourceId: string
}

const LANGUAGES: { value: SdkLanguage; label: string; icon: string }[] = [
  { value: 'typescript', label: 'TypeScript', icon: 'TS' },
  { value: 'python', label: 'Python', icon: 'PY' },
  { value: 'go', label: 'Go', icon: 'GO' },
]

const EXT_COLORS: Record<string, string> = {
  ts: 'text-blue-600 dark:text-blue-400',
  py: 'text-yellow-600 dark:text-yellow-400',
  go: 'text-cyan-600 dark:text-cyan-400',
  json: 'text-amber-600 dark:text-amber-400',
  md: 'text-muted-foreground',
  txt: 'text-muted-foreground',
  mod: 'text-cyan-600 dark:text-cyan-400',
  cfg: 'text-muted-foreground',
}

function getExtColor(filename: string): string {
  const ext = filename.split('.').pop() || ''
  return EXT_COLORS[ext] || 'text-muted-foreground'
}

export function SdkGeneratorPanel({ openapiSourceId }: Props) {
  const [language, setLanguage] = useState<SdkLanguage>('typescript')
  const [packageName, setPackageName] = useState('my-api-sdk')
  const [version, setVersion] = useState('1.0.0')
  const [previewing, setPreviewing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [preview, setPreview] = useState<Record<string, string> | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handlePreview = async () => {
    if (!packageName.trim()) {
      toast.error('Package name is required')
      return
    }
    setPreviewing(true)
    setPreview(null)
    setSelectedFile(null)
    try {
      const res = await fetch('/api/sdk/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openapiSourceId, language, packageName: packageName.trim(), version }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Preview failed')
      }
      const data = await res.json()
      setPreview(data)
      const firstFile = Object.keys(data)[0]
      if (firstFile) setSelectedFile(firstFile)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate preview')
    } finally {
      setPreviewing(false)
    }
  }

  const handleDownload = async () => {
    if (!packageName.trim()) {
      toast.error('Package name is required')
      return
    }
    setDownloading(true)
    try {
      const res = await fetch('/api/sdk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openapiSourceId, language, packageName: packageName.trim(), version }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${packageName.trim()}-${language}-v${version}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('SDK downloaded')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to download SDK')
    } finally {
      setDownloading(false)
    }
  }

  const handleCopy = () => {
    if (!preview || !selectedFile) return
    navigator.clipboard.writeText(preview[selectedFile])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  const fileTree = preview ? buildFileTree(Object.keys(preview)) : null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">SDK Generator</CardTitle>
          <CardDescription className="text-xs">
            Generate a type-safe client SDK from your OpenAPI specification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language selector */}
          <div className="space-y-2">
            <Label className="text-xs">Language</Label>
            <Tabs value={language} onValueChange={(v) => { setLanguage(v as SdkLanguage); setPreview(null) }}>
              <TabsList className="grid w-full grid-cols-3">
                {LANGUAGES.map((lang) => (
                  <TabsTrigger key={lang.value} value={lang.value} className="gap-1.5 text-xs">
                    <Badge variant="outline" className="px-1 py-0 text-[9px] font-mono">
                      {lang.icon}
                    </Badge>
                    {lang.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Package name & version */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pkg-name" className="text-xs">Package Name</Label>
              <Input
                id="pkg-name"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="my-api-sdk"
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-version" className="text-xs">Version</Label>
              <Input
                id="pkg-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={previewing || !packageName.trim()}
            >
              {previewing ? (
                <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Eye className="mr-1.5 size-3.5" />
              )}
              Preview
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={downloading || !packageName.trim()}
            >
              {downloading ? (
                <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 size-3.5" />
              )}
              Download SDK
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && fileTree && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                <FolderTree className="size-3.5" />
                Generated Files
                <Badge variant="secondary" className="text-[10px]">
                  {Object.keys(preview).length} files
                </Badge>
              </CardTitle>
              {selectedFile && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs">
                  {copied ? (
                    <Check className="mr-1 size-3" />
                  ) : (
                    <Copy className="mr-1 size-3" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-3 rounded-md border">
              {/* File tree */}
              <div className="w-56 shrink-0 border-r">
                <ScrollArea className="h-[420px] p-2">
                  {renderTree(fileTree, selectedFile, setSelectedFile)}
                </ScrollArea>
              </div>

              {/* File content */}
              <div className="min-w-0 flex-1">
                <ScrollArea className="h-[420px]">
                  {selectedFile && preview[selectedFile] ? (
                    <div className="p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <FileCode2 className={`size-3.5 ${getExtColor(selectedFile)}`} />
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {selectedFile}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                        {preview[selectedFile]}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center py-20 text-xs text-muted-foreground">
                      Select a file to view its contents
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// File tree helpers

interface TreeNode {
  name: string
  fullPath: string
  children: TreeNode[]
  isFile: boolean
}

function buildFileTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', children: [], isFile: false }

  for (const path of paths.sort()) {
    const parts = path.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const fullPath = parts.slice(0, i + 1).join('/')
      let child = current.children.find((c) => c.name === part)
      if (!child) {
        child = { name: part, fullPath, children: [], isFile }
        current.children.push(child)
      }
      current = child
    }
  }

  return root
}

function renderTree(
  node: TreeNode,
  selectedFile: string | null,
  onSelect: (path: string) => void,
  depth = 0,
): React.ReactNode {
  if (node.name === '') {
    return node.children.map((child) => renderTree(child, selectedFile, onSelect, 0))
  }

  const isSelected = node.isFile && node.fullPath === selectedFile
  const indent = depth * 12

  if (node.isFile) {
    return (
      <button
        key={node.fullPath}
        onClick={() => onSelect(node.fullPath)}
        className={`flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] transition-colors ${
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        style={{ paddingLeft: `${indent + 6}px` }}
      >
        <FileCode2 className={`size-3 shrink-0 ${getExtColor(node.name)}`} />
        <span className="truncate font-mono">{node.name}</span>
      </button>
    )
  }

  return (
    <div key={node.fullPath}>
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
        style={{ paddingLeft: `${indent + 6}px` }}
      >
        <ChevronRight className="size-3 text-muted-foreground" />
        <span>{node.name}</span>
      </div>
      {node.children.map((child) => renderTree(child, selectedFile, onSelect, depth + 1))}
    </div>
  )
}
