'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutTemplate,
  Plus,
  Trash2,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Template {
  id: string
  name: string
  description: string
  category: string
  content: string
  usageCount: number
  isBuiltIn: boolean
  createdAt: string
}

const CATEGORIES = [
  { value: 'getting-started', label: 'Getting Started' },
  { value: 'api-reference', label: 'API Reference' },
  { value: 'changelog', label: 'Changelog' },
  { value: 'migration-guide', label: 'Migration Guide' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'custom', label: 'Custom' },
]

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState('custom')
  const [content, setContent] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const refresh = React.useCallback(async () => {
    const res = await fetch('/api/templates')
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, category, content }),
      })
      if (res.ok) {
        setCreateOpen(false)
        setName('')
        setDescription('')
        setCategory('custom')
        setContent('')
        refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    refresh()
  }

  const handleUse = async (id: string) => {
    const res = await fetch(`/api/templates/${id}/create-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      const doc = await res.json()
      router.push(`/docs/editor/${doc.id}`)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Template Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable document structures for common documentation patterns
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Template</DialogTitle>
              <DialogDescription>
                Create a reusable document template
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Template name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Brief description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Content (Markdown)</Label>
                <Textarea
                  className="min-h-[150px] font-mono text-xs"
                  placeholder="# Title\n\n## Section"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={saving || !name}
              >
                {saving ? 'Creating…' : 'Create Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <LayoutTemplate className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No templates yet. Create your first template to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <Card
              key={tpl.id}
              className="group transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{tpl.name}</CardTitle>
                  {tpl.isBuiltIn && (
                    <Badge variant="secondary" className="text-[10px]">
                      Built-in
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-2 text-xs">
                  {tpl.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORIES.find((c) => c.value === tpl.category)
                        ?.label ?? tpl.category}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Used {tpl.usageCount}×
                    </span>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleUse(tpl.id)}
                      title="Use template"
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                    {!tpl.isBuiltIn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleDelete(tpl.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
