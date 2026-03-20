import { z } from 'zod'
import { tool } from 'ai'
import { db } from '@/lib/db'
import { retrieveWorkspaceRagContext } from '@/lib/ai-chat'
import { escapeLikePattern } from '@/lib/ai/visibility-filter'
import { createQueryMatchPlan } from '@/lib/search/query-terms'
import { documents, openapiSources, apiEndpoints } from '@/lib/schema'
import { eq, and, sql, isNull, desc } from 'drizzle-orm'
import { updateAgentTaskStatus } from '@/lib/queries/agent'
import { waitForInteraction } from '@/lib/agent/interactions'
import {
  docAgentInteractivePageCatalog,
  validateDocAgentInteractivePageSpec,
} from '@/lib/agent/interactive-page'
import {
  buildDocAgentInteractivePageTemplate,
  docAgentInteractivePageTemplateInputSchema,
} from '@/lib/agent/interactive-page-templates'

// ─── Workspace-scoped tool context ──────────────────────────

export interface AgentToolContext {
  workspaceId: string
  userId: string
  taskId?: string
  documentId?: string
}

function buildSearchPreview(
  content: string | null | undefined,
  summary: string | null | undefined,
  terms: string[],
) {
  const normalizedSummary = typeof summary === 'string'
    ? summary.replace(/\s+/g, ' ').trim()
    : ''
  const normalizedContent = typeof content === 'string'
    ? content.replace(/\s+/g, ' ').trim()
    : ''

  const sources = [normalizedSummary, normalizedContent].filter(Boolean)
  const rankedTerms = [...terms].sort((left, right) => right.length - left.length)

  for (const source of sources) {
    const lowerSource = source.toLowerCase()
    for (const term of rankedTerms) {
      const index = lowerSource.indexOf(term.toLowerCase())
      if (index < 0) continue

      const start = Math.max(0, index - 60)
      const end = Math.min(source.length, index + 160)
      return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`.slice(0, 240)
    }
  }

  return (normalizedSummary || normalizedContent).slice(0, 240)
}

function buildDocumentFieldMatches(terms: string[]) {
  if (terms.length === 0) return sql`false`

  return sql`(${sql.join(
    terms.map((term) => {
      const pattern = `%${escapeLikePattern(term)}%`
      return sql`(
        ${documents.title} ILIKE ${pattern}
        OR ${documents.slug} ILIKE ${pattern}
        OR ${documents.content} ILIKE ${pattern}
      )`
    }),
    sql` OR `,
  )})`
}

function buildDocumentMatchCount(terms: string[]) {
  if (terms.length === 0) return sql<number>`0`

  return sql<number>`${sql.join(
    terms.map((term) => {
      const pattern = `%${escapeLikePattern(term)}%`
      return sql`CASE
        WHEN (
          ${documents.title} ILIKE ${pattern}
          OR ${documents.slug} ILIKE ${pattern}
          OR ${documents.content} ILIKE ${pattern}
        ) THEN 1
        ELSE 0
      END`
    }),
    sql` + `,
  )}`
}

function buildDocumentWeightedScore(
  terms: string[],
  weights: {
    title: number
    slug: number
    content: number
  },
  scaleByLength = false,
) {
  if (terms.length === 0) return sql<number>`0`

  return sql<number>`${sql.join(
    terms.flatMap((term) => {
      const pattern = `%${escapeLikePattern(term)}%`
      const compactLength = term.replace(/[\s_-]+/g, '').length
      const lengthBoost = scaleByLength ? Math.min(4, Math.max(0, compactLength - 2)) : 0
      return [
        sql`CASE WHEN ${documents.title} ILIKE ${pattern} THEN ${weights.title + lengthBoost} ELSE 0 END`,
        sql`CASE WHEN ${documents.slug} ILIKE ${pattern} THEN ${weights.slug + lengthBoost} ELSE 0 END`,
        sql`CASE WHEN ${documents.content} ILIKE ${pattern} THEN ${weights.content + lengthBoost} ELSE 0 END`,
      ]
    }),
    sql` + `,
  )}`
}

// ─── Tool factory ───────────────────────────────────────────

export function createAgentTools(ctx: AgentToolContext) {
  const promptInteractivePage = async (message: string, spec: unknown) => {
    const validation = validateDocAgentInteractivePageSpec(spec)
    if (!validation.success) {
      return { error: validation.error }
    }

    const interactionId = crypto.randomUUID()
    await updateAgentTaskStatus(ctx.workspaceId, ctx.taskId!, 'waiting_for_input', {
      interaction: { id: interactionId, type: 'page', message, spec: validation.data },
      progress: { currentStep: 0, maxSteps: 0, description: 'Waiting for interactive input…' },
    })

    try {
      const response = await waitForInteraction(ctx.taskId!, interactionId)
      await updateAgentTaskStatus(ctx.workspaceId, ctx.taskId!, 'running', {
        interaction: null,
        progress: { currentStep: 0, maxSteps: 0, description: 'Resuming…' },
      })

      if (response.type === 'page') {
        return {
          action: response.action,
          values: response.values,
        }
      }

      return {
        error: 'Received an unexpected interaction response type.',
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Interactive page was cancelled or timed out.',
      }
    }
  }

  return {
    search_documents: tool({
      description:
        'Search documents by keyword. Returns titles, slugs, and short previews.',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10).describe('Max results'),
      }),
      execute: async ({ query, limit }) => {
        const matchPlan = createQueryMatchPlan(query)
        const terms = matchPlan.previewTerms
        if (terms.length === 0) {
          return { results: [], message: 'No documents found.' }
        }

        const normalizedLimit = Math.min(Math.max(limit, 1), 20)
        const whereMatches = buildDocumentFieldMatches([
          ...matchPlan.primaryTerms,
          ...matchPlan.secondaryTerms,
        ])
        const exactCoverage = buildDocumentMatchCount(matchPlan.exactTerms)
        const primaryCoverage = buildDocumentMatchCount(matchPlan.primaryTerms)
        const secondaryCoverage = buildDocumentMatchCount(matchPlan.secondaryTerms)
        const keywordRank = sql<number>`
          ${buildDocumentWeightedScore(
            matchPlan.exactTerms,
            { title: 18, slug: 14, content: 10 },
          )} +
          ${buildDocumentWeightedScore(
            matchPlan.primaryTerms,
            { title: 8, slug: 6, content: 4 },
            true,
          )} +
          ${buildDocumentWeightedScore(
            matchPlan.secondaryTerms,
            { title: 3, slug: 2, content: 1 },
          )} +
          (${primaryCoverage} * 12) +
          (${secondaryCoverage} * 2)
        `

        const results = await db
          .select({
            id: documents.id,
            title: documents.title,
            slug: documents.slug,
            status: documents.status,
            summary: documents.summary,
            content: documents.content,
            exactCoverage,
            primaryCoverage,
            secondaryCoverage,
            rank: keywordRank,
          })
          .from(documents)
          .where(
            and(
              eq(documents.workspaceId, ctx.workspaceId),
              isNull(documents.deletedAt),
              whereMatches,
            ),
          )
          .orderBy(
            desc(exactCoverage),
            desc(primaryCoverage),
            desc(keywordRank),
            desc(secondaryCoverage),
            desc(documents.updatedAt),
          )
          .limit(normalizedLimit)

        if (results.length === 0) return { results: [], message: 'No documents found.' }
        return {
          results: results.map((d) => ({
            id: d.id,
            title: d.title,
            slug: d.slug,
            status: d.status,
            summary: buildSearchPreview(d.content, d.summary, terms),
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

    search_knowledge_base: tool({
      description:
        'Search the workspace knowledge base with RAG and return grounded context snippets plus their sources.',
      inputSchema: z.object({
        query: z.string().describe('The question or search query to run against the knowledge base'),
      }),
      execute: async ({ query }) => {
        const result = await retrieveWorkspaceRagContext({
          workspaceId: ctx.workspaceId,
          query,
          documentId: ctx.documentId,
          debug: false,
        })

        return {
          query,
          sourceCount: result.sources.length,
          sources: result.sources.map((source) => ({
            documentId: source.documentId,
            chunkId: source.chunkId,
            title: source.title,
            preview: source.preview,
            sourceType: source.sourceType ?? 'knowledge_source',
            relationType: source.relationType ?? 'primary',
          })),
          contextText: result.contextText || 'No relevant knowledge base content found.',
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

    // ─── Interaction tools (block until user responds) ────────

    ...(ctx.taskId ? {
      ask_confirm: tool({
        description:
          'Ask the user for confirmation before proceeding with a plan or destructive action. Blocks until the user responds.',
        inputSchema: z.object({
          message: z.string().describe('What you want to confirm with the user. Describe the plan or action clearly.'),
        }),
        execute: async ({ message }) => {
          const interactionId = crypto.randomUUID()
          await updateAgentTaskStatus(ctx.workspaceId, ctx.taskId!, 'waiting_for_input', {
            interaction: { id: interactionId, type: 'confirm', message },
            progress: { currentStep: 0, maxSteps: 0, description: 'Waiting for confirmation…' },
          })

          try {
            const response = await waitForInteraction(ctx.taskId!, interactionId)
            await updateAgentTaskStatus(ctx.workspaceId, ctx.taskId!, 'running', {
              interaction: null,
              progress: { currentStep: 0, maxSteps: 0, description: 'Resuming…' },
            })
            if (response.type === 'confirm') {
              return { accepted: response.accepted, feedback: response.feedback ?? null }
            }
            return { accepted: false, feedback: null }
          } catch {
            return { accepted: false, feedback: 'Interaction was cancelled or timed out.' }
          }
        },
      }),

      ask_select: tool({
        description:
          'Present the user with 2-6 options to choose from. Blocks until the user selects one.',
        inputSchema: z.object({
          message: z.string().describe('Question or context for the selection'),
          options: z.array(z.string()).min(2).max(6).describe('The options to choose from'),
        }),
        execute: async ({ message, options }) => {
          const interactionId = crypto.randomUUID()
          await updateAgentTaskStatus(ctx.workspaceId, ctx.taskId!, 'waiting_for_input', {
            interaction: { id: interactionId, type: 'select', message, options },
            progress: { currentStep: 0, maxSteps: 0, description: 'Waiting for selection…' },
          })

          try {
            const response = await waitForInteraction(ctx.taskId!, interactionId)
            await updateAgentTaskStatus(ctx.workspaceId, ctx.taskId!, 'running', {
              interaction: null,
              progress: { currentStep: 0, maxSteps: 0, description: 'Resuming…' },
            })
            if (response.type === 'select') {
              return { selected: response.selected }
            }
            return { selected: options[0] }
          } catch {
            return { selected: options[0] }
          }
        },
      }),

      ask_input: tool({
        description:
          'Ask the user for free-form text input. Use when you need additional information, context, or instructions.',
        inputSchema: z.object({
          message: z.string().describe('What you need from the user'),
          placeholder: z.string().optional().describe('Placeholder text for the input field'),
        }),
        execute: async ({ message, placeholder }) => {
          const interactionId = crypto.randomUUID()
          await updateAgentTaskStatus(ctx.workspaceId, ctx.taskId!, 'waiting_for_input', {
            interaction: { id: interactionId, type: 'input', message, placeholder },
            progress: { currentStep: 0, maxSteps: 0, description: 'Waiting for input…' },
          })

          try {
            const response = await waitForInteraction(ctx.taskId!, interactionId)
            await updateAgentTaskStatus(ctx.workspaceId, ctx.taskId!, 'running', {
              interaction: null,
              progress: { currentStep: 0, maxSteps: 0, description: 'Resuming…' },
            })
            if (response.type === 'input') {
              return { text: response.text }
            }
            return { text: '' }
          } catch {
            return { text: '' }
          }
        },
      }),

      ask_page: tool({
        description:
          'Ask the user to interact with a compact custom page rendered from the Doc Agent interactive catalog. Use when no built-in template fits and you need a custom multi-field flow.',
        inputSchema: z.object({
          message: z.string().trim().min(1).max(1000).describe('Short context shown above the page'),
          spec: docAgentInteractivePageCatalog.zodSchema().describe('A json-render spec using only the approved Doc Agent interactive components and actions'),
        }),
        execute: async ({ message, spec }) => {
          return promptInteractivePage(message, spec)
        },
      }),

      ask_page_template: tool({
        description:
          'Ask the user to interact with one of the built-in Doc Agent page templates. Prefer this over raw ask_page for approvals, project briefs, revision strategy choices, and bulk confirmations.',
        inputSchema: docAgentInteractivePageTemplateInputSchema,
        execute: async (input) => {
          const page = buildDocAgentInteractivePageTemplate(input)
          return promptInteractivePage(page.message, page.spec)
        },
      }),
    } : {}),
  }
}
