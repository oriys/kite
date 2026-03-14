'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Copy,
  LayoutTemplate,
  PencilLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { FeatureGuard } from '@/components/docs/feature-guard'
import {
  getTemplateCategoryLabel,
  getTemplateEditorHref,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
} from '@/lib/templates'
import { useTemplates } from '@/hooks/use-templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function TemplatesPage() {
  const router = useRouter()
  const { items: templates, loading, create, remove, duplicate } = useTemplates()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState<TemplateCategory>('custom')
  const [saving, setSaving] = React.useState(false)
  const [busyTemplateId, setBusyTemplateId] = React.useState<string | null>(null)

  const handleCreate = async () => {
    setSaving(true)
    try {
      const template = await create({
        name: name.trim(),
        description: description.trim(),
        category,
        content: '',
      })

      if (!template) {
        toast.error('Failed to create template')
        return
      }

      setCreateOpen(false)
      setName('')
      setDescription('')
      setCategory('custom')
      router.push(getTemplateEditorHref(template.id))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setBusyTemplateId(id)
    try {
      const deleted = await remove(id)
      if (!deleted) {
        toast.error('Failed to delete template')
        return
      }
      toast.success('Template deleted')
    } finally {
      setBusyTemplateId(null)
    }
  }

  const handleDuplicate = async (id: string) => {
    setBusyTemplateId(id)
    try {
      const template = await duplicate(id)
      if (!template) {
        toast.error('Failed to duplicate template')
        return
      }

      toast.success('Template duplicated', {
        description: `Created "${template.name}".`,
      })
      router.push(getTemplateEditorHref(template.id))
    } finally {
      setBusyTemplateId(null)
    }
  }

  return (
    <FeatureGuard featureId="templates">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Template Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable document structures for common documentation patterns.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Template</DialogTitle>
              <DialogDescription>
                Create the template shell, then edit content with the full
                document editor.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  placeholder="Template name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="template-description">Description</Label>
                <Input
                  id="template-description"
                  placeholder="Brief description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="template-category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as TemplateCategory)
                  }
                >
                  <SelectTrigger id="template-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !name.trim()}>
                {saving ? 'Creating…' : 'Create Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Spinner className="mx-auto size-5 text-muted-foreground" />
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
          {templates.map((template) => {
            const isBusy = busyTemplateId === template.id

            return (
              <Card
                key={template.id}
                className="group cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(getTemplateEditorHref(template.id))}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-sm">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2 text-xs">
                        {template.description}
                      </CardDescription>
                    </div>
                    {template.isBuiltIn ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Built-in
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {getTemplateCategoryLabel(template.category)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Used {template.usageCount}×
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(event) => {
                              event.stopPropagation()
                              router.push(getTemplateEditorHref(template.id))
                            }}
                          >
                            <PencilLine className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit template</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={isBusy}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleDuplicate(template.id)
                            }}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate template</TooltipContent>
                      </Tooltip>
                      {!template.isBuiltIn ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              disabled={isBusy}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDelete(template.id)
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete template</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      </div>
    </FeatureGuard>
  )
}
