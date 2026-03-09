export function getDocEditorHref(id: string): string {
  return `/docs/editor?doc=${encodeURIComponent(id)}`
}
