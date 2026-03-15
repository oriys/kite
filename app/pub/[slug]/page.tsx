import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileText, ArrowRight } from 'lucide-react'
import { getPublishedWorkspace, getPublishedDocuments } from '@/lib/queries/public-docs'
import { recordPageView } from '@/lib/queries/page-analytics'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PublicDocsIndex({ params }: PageProps) {
  const { slug } = await params
  const workspace = await getPublishedWorkspace(slug)
  if (!workspace) notFound()

  const { sections } = await getPublishedDocuments(workspace.id)

  recordPageView({
    workspaceId: workspace.id,
    path: `/pub/${slug}`,
    source: 'public',
  }).catch(() => {})

  const sectionEntries = Object.entries(sections)

  return (
    <div>
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {workspace.branding?.metaTitle || `${workspace.name} Documentation`}
        </h1>
        {workspace.branding?.metaDescription && (
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {workspace.branding.metaDescription}
          </p>
        )}
      </header>

      {sectionEntries.length === 0 ? (
        <p className="text-muted-foreground">No published documentation yet.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {sectionEntries.map(([section, docs]) => (
            <section key={section}>
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section}
              </h2>
              <div className="grid gap-3">
                {docs.map((doc) => {
                  const docSlug = doc.publishedSlug || doc.slug || doc.id
                  return (
                    <Link
                      key={doc.id}
                      href={`/pub/${slug}/${docSlug}`}
                      className="group flex items-start gap-4 rounded-lg border bg-card/50 px-5 py-4 transition-colors hover:bg-card"
                    >
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-foreground group-hover:text-primary">
                          {doc.title}
                        </h3>
                        {doc.summary && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {doc.summary}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
