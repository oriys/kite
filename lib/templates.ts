export const TEMPLATE_CATEGORIES = [
  { value: 'getting-started', label: 'Getting Started' },
  { value: 'api-reference', label: 'API Reference' },
  { value: 'changelog', label: 'Changelog' },
  { value: 'migration-guide', label: 'Migration Guide' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'custom', label: 'Custom' },
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]['value']

export interface Template {
  id: string
  name: string
  description: string
  category: TemplateCategory
  content: string
  usageCount: number
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
  workspaceId: string
  createdBy: string | null
  thumbnail: string | null
}

export function normalizeTemplate(raw: Record<string, unknown>): Template {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    category: (raw.category as TemplateCategory) ?? 'custom',
    content: String(raw.content ?? ''),
    usageCount: Number(raw.usageCount ?? 0),
    isBuiltIn: Boolean(raw.isBuiltIn),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? ''),
    workspaceId: String(raw.workspaceId ?? ''),
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    thumbnail: raw.thumbnail ? String(raw.thumbnail) : null,
  }
}

export function normalizeTemplateList(raw: unknown[]): Template[] {
  return raw.map((item) => normalizeTemplate(item as Record<string, unknown>))
}

export function getTemplateEditorHref(id: string) {
  return `/docs/templates/editor?template=${encodeURIComponent(id)}`
}

export function getTemplateCategoryLabel(category: string) {
  return TEMPLATE_CATEGORIES.find((item) => item.value === category)?.label ?? category
}
