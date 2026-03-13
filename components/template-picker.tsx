'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutTemplate,
  FileText,
  BookOpen,
  History,
  Compass,
  GraduationCap,
  AlertTriangle,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDocEditorHref } from '@/lib/documents'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Template {
  id: string
  name: string
  description: string
  category: string
  usageCount: number
  content: string
}

const categoryConfig: Record<
  string,
  { icon: typeof FileText; label: string; color: string }
> = {
  'getting-started': {
    icon: Compass,
    label: 'Getting Started',
    color: 'text-success',
  },
  'api-reference': {
    icon: FileText,
    label: 'API Reference',
    color: 'text-info',
  },
  changelog: { icon: History, label: 'Changelog', color: 'text-warning' },
  'migration-guide': {
    icon: BookOpen,
    label: 'Migration Guide',
    color: 'text-accent-foreground',
  },
  tutorial: {
    icon: GraduationCap,
    label: 'Tutorial',
    color: 'text-chart-2',
  },
  troubleshooting: {
    icon: AlertTriangle,
    label: 'Troubleshooting',
    color: 'text-destructive',
  },
  custom: { icon: Wrench, label: 'Custom', color: 'text-muted-foreground' },
}

interface TemplatePickerProps {
  trigger?: React.ReactNode
  onCreated?: (docId: string) => void
}

export function TemplatePicker({ trigger, onCreated }: TemplatePickerProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [loading, setLoading] = React.useState(false)
  const [, setCreating] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/templates')
      .then((r) => r.json())
      .then(setTemplates)
      .finally(() => setLoading(false))
  }, [open])

  const filtered = filter
    ? templates.filter((t) => t.category === filter)
    : templates

  const categories = [
    ...new Set(templates.map((t) => t.category)),
  ]

  const handleUseTemplate = async (templateId: string) => {
    setCreating(templateId)
    try {
      const res = await fetch(`/api/templates/${templateId}/create-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const doc = await res.json()
        setOpen(false)
        if (onCreated) onCreated(doc.id)
        else router.push(getDocEditorHref(doc.id))
      }
    } finally {
      setCreating(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            From Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
          <DialogDescription>
            Start with a pre-built structure to save time
          </DialogDescription>
        </DialogHeader>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={filter === null ? 'default' : 'ghost'}
              size="sm"
              className="h-6 text-xs"
              onClick={() => setFilter(null)}
            >
              All
            </Button>
            {categories.map((cat) => {
              const cfg = categoryConfig[cat] ?? categoryConfig.custom
              const Icon = cfg.icon
              return (
                <Button
                  key={cat}
                  variant={filter === cat ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() => setFilter(cat)}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </Button>
              )
            })}
          </div>
        )}

        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading templates…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No templates found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((tpl) => {
                const cfg =
                  categoryConfig[tpl.category] ?? categoryConfig.custom
                const Icon = cfg.icon
                return (
                  <Card
                    key={tpl.id}
                    className="cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => handleUseTemplate(tpl.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-4 w-4', cfg.color)} />
                        <CardTitle className="text-sm">{tpl.name}</CardTitle>
                      </div>
                      <CardDescription className="text-xs line-clamp-2">
                        {tpl.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-[10px]">
                          {cfg.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Used {tpl.usageCount}×
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
