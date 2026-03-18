import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/schema'
import { notFound, withWorkspaceAuth } from '@/lib/api-utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

const EXTENSION_MAP: Record<string, string> = {
  openapi: '.json',
  graphql: '.graphql',
  markdown: '.md',
  faq: '.json',
  zip: '.zip',
  asyncapi: '.json',
  protobuf: '.proto',
  rst: '.rst',
  asciidoc: '.adoc',
  csv: '.csv',
  sql_ddl: '.sql',
  typescript_defs: '.d.ts',
  postman: '.json',
  pdf: '.txt',
  url: '.txt',
  document: '.txt',
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  openapi: 'application/json',
  graphql: 'text/plain',
  markdown: 'text/markdown',
  faq: 'application/json',
  zip: 'application/zip',
  asyncapi: 'application/json',
  protobuf: 'text/plain',
  rst: 'text/plain',
  asciidoc: 'text/plain',
  csv: 'text/csv',
  sql_ddl: 'text/plain',
  typescript_defs: 'text/plain',
  postman: 'application/json',
  pdf: 'text/plain',
  url: 'text/plain',
  document: 'text/plain',
}

function looksLikeYaml(raw: string): boolean {
  const trimmed = raw.trimStart()
  return (
    trimmed.startsWith('openapi:') ||
    trimmed.startsWith('asyncapi:') ||
    trimmed.startsWith('---')
  )
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await context.params

  const [source] = await db
    .select({
      id: knowledgeSources.id,
      title: knowledgeSources.title,
      sourceType: knowledgeSources.sourceType,
      rawContent: knowledgeSources.rawContent,
      metadata: knowledgeSources.metadata,
    })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, id),
        eq(knowledgeSources.workspaceId, result.ctx.workspaceId),
        isNull(knowledgeSources.deletedAt),
      ),
    )
    .limit(1)

  if (!source) return notFound()

  const meta = (source.metadata ?? {}) as Record<string, unknown>
  const originalFileName = typeof meta.fileName === 'string' ? meta.fileName : null

  const isYaml =
    (source.sourceType === 'openapi' || source.sourceType === 'asyncapi') &&
    looksLikeYaml(source.rawContent)

  let ext = EXTENSION_MAP[source.sourceType] ?? '.txt'
  let contentType = CONTENT_TYPE_MAP[source.sourceType] ?? 'text/plain'

  if (isYaml) {
    ext = '.yaml'
    contentType = 'application/x-yaml'
  }

  const fileName =
    originalFileName ||
    `${source.title.replace(/[^a-zA-Z0-9_\-. ]/g, '_')}${ext}`

  // Zip content is stored as base64
  if (source.sourceType === 'zip') {
    const buffer = Buffer.from(source.rawContent, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  }

  return new NextResponse(source.rawContent, {
    headers: {
      'Content-Type': `${contentType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
