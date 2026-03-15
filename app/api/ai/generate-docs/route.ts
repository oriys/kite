import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'

import { generateEndpointDocs } from '@/lib/ai-doc-generator'
import { AiCompletionError } from '@/lib/ai-server'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { createDocument } from '@/lib/queries/documents'
import { apiEndpoints, openapiSources } from '@/lib/schema'
import { logServerError } from '@/lib/server-errors'

const MAX_ENDPOINTS_PER_REQUEST = 50

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const openapiSourceId =
    typeof body.openapiSourceId === 'string' ? body.openapiSourceId : ''
  const endpointIds = Array.isArray(body.endpointIds) ? body.endpointIds : []
  const model = typeof body.model === 'string' ? body.model.trim() : undefined

  if (!openapiSourceId) {
    return badRequest('openapiSourceId is required')
  }

  // Verify the OpenAPI source belongs to this workspace
  const source = await db.query.openapiSources.findFirst({
    where: and(
      eq(openapiSources.id, openapiSourceId),
      eq(openapiSources.workspaceId, result.ctx.workspaceId),
    ),
  })

  if (!source) {
    return badRequest('OpenAPI source not found')
  }

  // Fetch endpoints
  const endpointFilter =
    endpointIds.length > 0
      ? and(
          eq(apiEndpoints.sourceId, openapiSourceId),
          inArray(apiEndpoints.id, endpointIds),
        )
      : eq(apiEndpoints.sourceId, openapiSourceId)

  const endpoints = await db
    .select()
    .from(apiEndpoints)
    .where(endpointFilter)
    .limit(MAX_ENDPOINTS_PER_REQUEST)

  if (endpoints.length === 0) {
    return badRequest('No endpoints found')
  }

  try {
    // Build parsed endpoint input from database rows
    const parsedEndpoints = endpoints.map((ep) => ({
      id: ep.id,
      method: (ep.method ?? 'GET').toUpperCase(),
      path: ep.path ?? '/',
      operationId: ep.operationId ?? undefined,
      summary: ep.summary ?? undefined,
      description: ep.description ?? undefined,
      tags: (ep.tags as string[] | null) ?? [],
      parameters: (ep.parameters as Array<Record<string, unknown>>) ?? [],
      requestBody: (ep.requestBody as Record<string, unknown> | null) ?? null,
      responses: (ep.responses as Record<string, unknown>) ?? {},
      deprecated: ep.deprecated ?? false,
    }))

    const batchResult = await generateEndpointDocs({
      workspaceId: result.ctx.workspaceId,
      endpoints: parsedEndpoints,
      model,
    })

    // Create or update documents for each generated doc
      const generatedDocs = []
      for (const gen of batchResult.results) {
        if (gen.status !== 'success' || !gen.content) continue

        const title = gen.title || `${gen.method} ${gen.path}`
        const doc = await createDocument(
          result.ctx.workspaceId,
          title,
          gen.content,
          result.ctx.userId,
        )

        generatedDocs.push({
          endpointMethod: gen.method,
        endpointPath: gen.path,
        documentId: doc.id,
        title,
      })
    }

    return NextResponse.json({
      generated: generatedDocs.length,
      total: endpoints.length,
      documents: generatedDocs,
    })
  } catch (error) {
    logServerError('AI doc generation failed', error, {
      workspaceId: result.ctx.workspaceId,
      openapiSourceId,
    })

    const message =
      error instanceof Error ? error.message : 'Generation failed'
    const status = error instanceof AiCompletionError ? error.status : 502

    return NextResponse.json({ error: message }, { status })
  }
}
