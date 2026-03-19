import { z } from 'zod'
import { tool } from 'ai'
import { db } from '@/lib/db'
import { documents, openapiSources, apiEndpoints } from '@/lib/schema'
import { eq, and, sql, isNull, desc } from 'drizzle-orm'

// ─── Workspace-scoped tool context ──────────────────────────

export interface AgentToolContext {
  workspaceId: string
  userId: string
}

// ─── Tool factory ───────────────────────────────────────────

export function createAgentTools(ctx: AgentToolContext) {
  return {
    search_documents: tool({
      description:
        'Search documents by keyword. Returns titles, slugs, and short previews.',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10).describe('Max results'),
      }),
      execute: async ({ query, limit }) => {
        const results = await db
          .select({
            id: documents.id,
            title: documents.title,
            slug: documents.slug,
            status: documents.status,
            summary: documents.summary,
          })
          .from(documents)
          .where(
            and(
              eq(documents.workspaceId, ctx.workspaceId),
              isNull(documents.deletedAt),
              sql`(
                ${documents.title} ILIKE ${'%' + query + '%'}
                OR ${documents.slug} ILIKE ${'%' + query + '%'}
                OR ${documents.content} ILIKE ${'%' + query + '%'}
              )`,
            ),
          )
          .limit(limit)

        if (results.length === 0) return { results: [], message: 'No documents found.' }
        return {
          results: results.map((d) => ({
            id: d.id,
            title: d.title,
            slug: d.slug,
            status: d.status,
            summary: d.summary?.slice(0, 200),
          })),
        }
      },
    }),

    list_documents: tool({
      description:
        'List documents in the workspace with optional status filter.',
      inputSchema: z.object({
        status: z
          .enum(['draft', 'review', 'published', 'archived'])
          .optional()
          .describe('Filter by status'),
        limit: z.number().optional().default(20).describe('Max results'),
      }),
      execute: async ({ status, limit }) => {
        const conditions = [
          eq(documents.workspaceId, ctx.workspaceId),
          isNull(documents.deletedAt),
        ]
        if (status) {
          conditions.push(eq(documents.status, status))
        }

        const results = await db
          .select({
            id: documents.id,
            title: documents.title,
            slug: documents.slug,
            status: documents.status,
            updatedAt: documents.updatedAt,
          })
          .from(documents)
          .where(and(...conditions))
          .orderBy(desc(documents.updatedAt))
          .limit(limit)

        return {
          total: results.length,
          documents: results.map((d) => ({
            id: d.id,
            title: d.title,
            slug: d.slug,
            status: d.status,
            updatedAt: d.updatedAt,
          })),
        }
      },
    }),

    get_document: tool({
      description:
        'Get the full content of a document by slug or ID. Returns Markdown content.',
      inputSchema: z.object({
        slug: z.string().describe('Document slug or ID'),
      }),
      execute: async ({ slug }) => {
        const [doc] = await db
          .select({
            id: documents.id,
            title: documents.title,
            slug: documents.slug,
            status: documents.status,
            content: documents.content,
            updatedAt: documents.updatedAt,
          })
          .from(documents)
          .where(
            and(
              eq(documents.workspaceId, ctx.workspaceId),
              isNull(documents.deletedAt),
              sql`(${documents.slug} = ${slug} OR ${documents.id} = ${slug})`,
            ),
          )
          .limit(1)

        if (!doc) return { error: `Document "${slug}" not found.` }
        return {
          id: doc.id,
          title: doc.title,
          slug: doc.slug,
          status: doc.status,
          content: doc.content ?? '',
          updatedAt: doc.updatedAt,
        }
      },
    }),

    create_document: tool({
      description: 'Create a new document in the workspace.',
      inputSchema: z.object({
        title: z.string().describe('Document title'),
        content: z.string().optional().default('').describe('Markdown content'),
      }),
      execute: async ({ title, content }) => {
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 80)

        const id = crypto.randomUUID()
        await db.insert(documents).values({
          id,
          workspaceId: ctx.workspaceId,
          title,
          slug: `${slug}-${id.slice(0, 6)}`,
          content,
          status: 'draft',
          createdBy: ctx.userId,
        })

        return { id, title, slug: `${slug}-${id.slice(0, 6)}`, status: 'draft' }
      },
    }),

    update_document: tool({
      description:
        'Update a document by slug or ID. Can update title, content, or both.',
      inputSchema: z.object({
        slug: z.string().describe('Document slug or ID'),
        title: z.string().optional().describe('New title'),
        content: z.string().optional().describe('New Markdown content'),
      }),
      execute: async ({ slug, title, content }) => {
        const [doc] = await db
          .select({ id: documents.id, title: documents.title })
          .from(documents)
          .where(
            and(
              eq(documents.workspaceId, ctx.workspaceId),
              isNull(documents.deletedAt),
              sql`(${documents.slug} = ${slug} OR ${documents.id} = ${slug})`,
            ),
          )
          .limit(1)

        if (!doc) return { error: `Document "${slug}" not found.` }

        const updates: Record<string, unknown> = { updatedAt: new Date() }
        if (title !== undefined) updates.title = title
        if (content !== undefined) updates.content = content

        await db
          .update(documents)
          .set(updates)
          .where(eq(documents.id, doc.id))

        return { id: doc.id, updated: Object.keys(updates).filter((k) => k !== 'updatedAt') }
      },
    }),

    publish_document: tool({
      description: 'Publish a document (transition to published status).',
      inputSchema: z.object({
        slug: z.string().describe('Document slug or ID'),
      }),
      execute: async ({ slug }) => {
        const [doc] = await db
          .select({ id: documents.id, title: documents.title, status: documents.status })
          .from(documents)
          .where(
            and(
              eq(documents.workspaceId, ctx.workspaceId),
              isNull(documents.deletedAt),
              sql`(${documents.slug} = ${slug} OR ${documents.id} = ${slug})`,
            ),
          )
          .limit(1)

        if (!doc) return { error: `Document "${slug}" not found.` }

        const allowedFrom = ['draft', 'review']
        if (!allowedFrom.includes(doc.status)) {
          return { error: `Cannot publish from "${doc.status}" status. Must be draft or review.` }
        }

        await db
          .update(documents)
          .set({ status: 'published', updatedAt: new Date() })
          .where(eq(documents.id, doc.id))

        return { id: doc.id, title: doc.title, previousStatus: doc.status, newStatus: 'published' }
      },
    }),

    get_openapi_spec: tool({
      description: 'Get an OpenAPI spec source by name or ID.',
      inputSchema: z.object({
        source: z.string().describe('Source name or ID'),
      }),
      execute: async ({ source }) => {
        const [spec] = await db
          .select({
            id: openapiSources.id,
            name: openapiSources.name,
            openapiVersion: openapiSources.openapiVersion,
            sourceType: openapiSources.sourceType,
            rawContent: openapiSources.rawContent,
            lastSyncedAt: openapiSources.lastSyncedAt,
          })
          .from(openapiSources)
          .where(
            and(
              eq(openapiSources.workspaceId, ctx.workspaceId),
              isNull(openapiSources.deletedAt),
              sql`(${openapiSources.name} = ${source} OR ${openapiSources.id} = ${source})`,
            ),
          )
          .limit(1)

        if (!spec) return { error: `OpenAPI source "${source}" not found.` }

        // Truncate raw content to avoid blowing up context
        const rawPreview = spec.rawContent
          ? spec.rawContent.slice(0, 8000) +
            (spec.rawContent.length > 8000 ? '\n...(truncated)' : '')
          : null

        return {
          id: spec.id,
          name: spec.name,
          openapiVersion: spec.openapiVersion,
          sourceType: spec.sourceType,
          rawContent: rawPreview,
          lastSyncedAt: spec.lastSyncedAt,
        }
      },
    }),

    list_api_endpoints: tool({
      description: 'List API endpoints from an OpenAPI source.',
      inputSchema: z.object({
        source: z.string().describe('OpenAPI source name or ID'),
      }),
      execute: async ({ source }) => {
        const [spec] = await db
          .select({ id: openapiSources.id, name: openapiSources.name })
          .from(openapiSources)
          .where(
            and(
              eq(openapiSources.workspaceId, ctx.workspaceId),
              isNull(openapiSources.deletedAt),
              sql`(${openapiSources.name} = ${source} OR ${openapiSources.id} = ${source})`,
            ),
          )
          .limit(1)

        if (!spec) return { error: `OpenAPI source "${source}" not found.` }

        const endpoints = await db
          .select({
            id: apiEndpoints.id,
            method: apiEndpoints.method,
            path: apiEndpoints.path,
            operationId: apiEndpoints.operationId,
            summary: apiEndpoints.summary,
            deprecated: apiEndpoints.deprecated,
          })
          .from(apiEndpoints)
          .where(eq(apiEndpoints.sourceId, spec.id))
          .orderBy(apiEndpoints.path, apiEndpoints.method)

        return {
          source: spec.name,
          total: endpoints.length,
          endpoints: endpoints.map((ep) => ({
            id: ep.id,
            method: ep.method,
            path: ep.path,
            operationId: ep.operationId,
            summary: ep.summary,
            deprecated: ep.deprecated,
          })),
        }
      },
    }),

    translate_text: tool({
      description:
        'Translate a piece of text to a target language. Returns only the translated text.',
      inputSchema: z.object({
        text: z.string().describe('Text to translate'),
        targetLanguage: z.string().describe('Target language (e.g., "English", "Chinese", "Japanese")'),
      }),
      // This tool is handled by the engine via LLM — marked as execute-less
      // The engine intercepts this and delegates to the LLM
      execute: async ({ text, targetLanguage }) => {
        // The agent engine handles translation by asking the LLM directly.
        // This stub returns the input so the engine knows to intercept.
        return { _delegate: 'llm', text, targetLanguage }
      },
    }),

    lint_document: tool({
      description:
        'Check a document for quality issues: broken links, missing sections, readability.',
      inputSchema: z.object({
        slug: z.string().describe('Document slug or ID'),
      }),
      execute: async ({ slug }) => {
        const [doc] = await db
          .select({
            id: documents.id,
            title: documents.title,
            content: documents.content,
          })
          .from(documents)
          .where(
            and(
              eq(documents.workspaceId, ctx.workspaceId),
              isNull(documents.deletedAt),
              sql`(${documents.slug} = ${slug} OR ${documents.id} = ${slug})`,
            ),
          )
          .limit(1)

        if (!doc) return { error: `Document "${slug}" not found.` }

        const content = doc.content ?? ''
        const issues: string[] = []

        if (content.length < 100) issues.push('Document is very short (< 100 chars)')
        if (!content.match(/^#\s/m)) issues.push('Missing top-level heading')
        if (!content.match(/^##\s/m)) issues.push('No section headings found')

        const brokenLinkPattern = /\[([^\]]*)\]\(([^)]*)\)/g
        let match
        const links: string[] = []
        while ((match = brokenLinkPattern.exec(content)) !== null) {
          links.push(match[2])
        }
        const emptyLinks = links.filter((l) => !l || l === '#')
        if (emptyLinks.length > 0) {
          issues.push(`${emptyLinks.length} link(s) with empty or placeholder URLs`)
        }

        if (!content.includes('```')) issues.push('No code examples found')

        const wordCount = content.split(/\s+/).filter(Boolean).length

        return {
          title: doc.title,
          wordCount,
          linkCount: links.length,
          issueCount: issues.length,
          issues,
          quality: issues.length === 0 ? 'good' : issues.length <= 2 ? 'fair' : 'needs_work',
        }
      },
    }),
  }
}
