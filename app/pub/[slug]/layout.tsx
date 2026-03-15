import * as React from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublishedWorkspace, getPublishedDocuments, getPublishedEndpoints } from '@/lib/queries/public-docs'
import { PublicLayout } from '@/components/public/public-layout'

interface LayoutProps {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params
  const workspace = await getPublishedWorkspace(slug)
  if (!workspace) return {}

  const branding = workspace.branding
  return {
    title: {
      default: branding?.metaTitle || workspace.name,
      template: `%s | ${branding?.metaTitle || workspace.name}`,
    },
    description: branding?.metaDescription || `Documentation for ${workspace.name}`,
    ...(branding?.ogImageUrl && {
      openGraph: { images: [{ url: branding.ogImageUrl }] },
    }),
  }
}

export default async function PublicDocsLayout({ params, children }: LayoutProps) {
  const { slug } = await params
  const workspace = await getPublishedWorkspace(slug)
  if (!workspace) notFound()

  const { sections: sectionMap } = await getPublishedDocuments(workspace.id)
  const { endpoints } = await getPublishedEndpoints(workspace.id)

  const sections = Object.entries(sectionMap).map(([title, docs]) => ({
    title,
    docs,
  }))

  return (
    <PublicLayout
      workspace={workspace}
      sections={sections}
      hasApiReference={endpoints.length > 0}
    >
      {children}
    </PublicLayout>
  )
}
