import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublishedWorkspace, getPublishedEndpoints } from '@/lib/queries/public-docs'
import { recordPageView } from '@/lib/queries/page-analytics'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const workspace = await getPublishedWorkspace(slug)
  if (!workspace) return {}

  return {
    title: 'API Reference',
    description: `API Reference for ${workspace.name}`,
  }
}

const METHOD_STYLES: Record<string, string> = {
  get: 'bg-[var(--method-get)]/12 text-[var(--method-get)] border-[var(--method-get)]/25',
  post: 'bg-[var(--method-post)]/12 text-[var(--method-post)] border-[var(--method-post)]/25',
  put: 'bg-[var(--method-put)]/12 text-[var(--method-put)] border-[var(--method-put)]/25',
  delete: 'bg-[var(--method-delete)]/12 text-[var(--method-delete)] border-[var(--method-delete)]/25',
  patch: 'bg-[var(--method-patch)]/12 text-[var(--method-patch)] border-[var(--method-patch)]/25',
}

function MethodBadge({ method }: { method: string }) {
  const lower = method.toLowerCase()
  return (
    <span
      className={cn(
        'inline-flex w-16 items-center justify-center rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider',
        METHOD_STYLES[lower] || 'bg-muted text-muted-foreground border-border',
      )}
    >
      {method}
    </span>
  )
}

export default async function ApiReferencePage({ params }: PageProps) {
  const { slug } = await params
  const workspace = await getPublishedWorkspace(slug)
  if (!workspace) notFound()

  const { byTag, endpoints } = await getPublishedEndpoints(workspace.id)

  recordPageView({
    workspaceId: workspace.id,
    path: `/pub/${slug}/api-reference`,
    source: 'public',
  }).catch(() => {})

  if (endpoints.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">API Reference</h1>
        <p className="mt-4 text-muted-foreground">No API endpoints published yet.</p>
      </div>
    )
  }

  const tagEntries = Object.entries(byTag)

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">API Reference</h1>
        <p className="mt-2 text-muted-foreground">
          {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} available
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {tagEntries.map(([tag, tagEndpoints]) => (
          <section key={tag}>
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {tag}
            </h2>
            <div className="flex flex-col gap-1.5">
              {tagEndpoints.map((ep) => (
                <details key={ep.id} className="group rounded-lg border bg-card/50">
                  <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                    <MethodBadge method={ep.method} />
                    <code className="flex-1 truncate text-sm font-medium text-foreground">
                      {ep.path}
                    </code>
                    {ep.deprecated && (
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                        Deprecated
                      </span>
                    )}
                    {ep.summary && (
                      <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                        {ep.summary}
                      </span>
                    )}
                  </summary>

                  <div className="border-t px-4 py-4">
                    {ep.summary && (
                      <p className="mb-3 text-sm text-foreground">{ep.summary}</p>
                    )}
                    {ep.description && (
                      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                        {ep.description}
                      </p>
                    )}

                    {Array.isArray(ep.parameters) && ep.parameters.length > 0 && (
                      <div className="mb-4">
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                          Parameters
                        </h4>
                        <div className="overflow-x-auto rounded border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40">
                                <th className="px-3 py-2 text-left font-medium">Name</th>
                                <th className="px-3 py-2 text-left font-medium">In</th>
                                <th className="px-3 py-2 text-left font-medium">Required</th>
                                <th className="px-3 py-2 text-left font-medium">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ep.parameters.map((p, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="px-3 py-2 font-mono text-xs">
                                    {(p as Record<string, unknown>).name as string}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {(p as Record<string, unknown>).in as string}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {(p as Record<string, unknown>).required ? 'Yes' : 'No'}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {((p as Record<string, unknown>).description as string) || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {ep.responses && Object.keys(ep.responses as object).length > 0 && (
                      <div>
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                          Responses
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(ep.responses as Record<string, unknown>).map(
                            ([code, response]) => (
                              <span
                                key={code}
                                className={cn(
                                  'rounded border px-2 py-0.5 text-xs font-medium',
                                  code.startsWith('2')
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : code.startsWith('4') || code.startsWith('5')
                                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : 'border-border bg-muted text-muted-foreground',
                                )}
                                title={
                                  (response as Record<string, unknown>)?.description as string ||
                                  undefined
                                }
                              >
                                {code}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
