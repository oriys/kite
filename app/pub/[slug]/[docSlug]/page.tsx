import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublishedWorkspace, getPublishedDocument } from '@/lib/queries/public-docs'
import { recordPageView } from '@/lib/queries/page-analytics'
import { PublicDocReader } from '@/components/public/public-doc-reader'

interface PageProps {
  params: Promise<{ slug: string; docSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, docSlug } = await params
  const workspace = await getPublishedWorkspace(slug)
  if (!workspace) return {}

  const doc = await getPublishedDocument(workspace.id, docSlug)
  if (!doc) return {}

  const branding = workspace.branding
  return {
    title: doc.title,
    description: doc.summary || `${doc.title} — ${workspace.name}`,
    openGraph: {
      title: `${doc.title} | ${branding?.metaTitle || workspace.name}`,
      description: doc.summary || undefined,
      ...(branding?.ogImageUrl && { images: [{ url: branding.ogImageUrl }] }),
    },
  }
}

export default async function PublicDocPage({ params }: PageProps) {
  const { slug, docSlug } = await params
  const workspace = await getPublishedWorkspace(slug)
  if (!workspace) notFound()

  const doc = await getPublishedDocument(workspace.id, docSlug)
  if (!doc) notFound()

  recordPageView({
    workspaceId: workspace.id,
    documentId: doc.id,
    path: `/pub/${slug}/${docSlug}`,
    source: 'public',
  }).catch(() => {})

  return (
    <PublicDocReader
      title={doc.title}
      content={doc.content}
      updatedAt={doc.updatedAt}
    />
  )
}
