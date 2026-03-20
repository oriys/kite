import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'

import { generateOpenApiDocument } from '@/lib/ai-doc-generator'
import { AiCompletionError } from '@/lib/ai-server'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { recordDomainEvent } from '@/lib/observability/metrics'
import { withRouteObservability } from '@/lib/observability/route-handler'
import {
  DocGenerationMaterialError,
  isDocGenerationMaterialSourceType,
  retrieveDocGenerationContext,
  type DocGenerationMaterialInput,
} from '@/lib/openapi/doc-generation-rag'
import {
  buildOpenApiDocumentTitle,
  getOpenApiDocumentTypeMeta,
  getTemplateCategoryLabel,
  isOpenApiDocumentType,
} from '@/lib/openapi/document-types'
import { parseOpenAPISpec, type ParsedEndpoint } from '@/lib/openapi/parser'
import { createDocument } from '@/lib/queries/documents'
import {
  getTemplate,
  incrementTemplateUsage,
} from '@/lib/queries/templates'
import { isRagQueryMode } from '@/lib/rag/types'
import { apiEndpoints, openapiSources } from '@/lib/schema'
import { logServerError } from '@/lib/server-errors'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const MAX_ENDPOINTS_PER_REQUEST = 50

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function buildEndpointLookupKey(
  method: string,
  path: string,
  operationId?: string | null,
) {
  return operationId?.trim()
    ? `operation:${operationId.trim()}`
    : `${method.toUpperCase()} ${path}`
}

function buildParsedEndpointLookup(endpoints: ParsedEndpoint[]) {
  const lookup = new Map<string, ParsedEndpoint>()

  for (const endpoint of endpoints) {
    lookup.set(`${endpoint.method.toUpperCase()} ${endpoint.path}`, endpoint)
    if (endpoint.operationId) {
      lookup.set(
        buildEndpointLookupKey(
          endpoint.method,
          endpoint.path,
          endpoint.operationId,
        ),
        endpoint,
      )
    }
  }

  return lookup
}

async function generateDocsRoute(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const rl = checkRateLimit(`ai-generate:${result.ctx.userId}`, RATE_LIMITS.aiGenerate)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before generating another document.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const openapiSourceId =
    typeof body.openapiSourceId === 'string' ? body.openapiSourceId : ''
  const endpointIds: unknown[] = Array.isArray(body.endpointIds)
    ? body.endpointIds
    : []
  const model = typeof body.model === 'string' ? body.model.trim() : undefined
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const templateId = typeof body.templateId === 'string' ? body.templateId.trim() : ''
  const documentTypeInput =
    typeof body.documentType === 'string' ? body.documentType.trim() : ''
  const ragEnabled = body.ragEnabled === true
  const ragMode =
    typeof body.ragMode === 'string' && isRagQueryMode(body.ragMode)
      ? body.ragMode
      : undefined
  const multiTurnRag = body.multiTurnRag === true
  const rawMaterials: unknown[] = Array.isArray(body.materials)
    ? body.materials
    : []
  const materials = rawMaterials
    .map((value: unknown): DocGenerationMaterialInput | null => {
      if (!isRecord(value)) return null

      const sourceType =
        typeof value.sourceType === 'string' &&
        isDocGenerationMaterialSourceType(value.sourceType)
          ? value.sourceType
          : null

      if (!sourceType) return null

      return {
        sourceType,
        title: typeof value.title === 'string' ? value.title.trim() : '',
        rawContent:
          typeof value.rawContent === 'string' ? value.rawContent : undefined,
        sourceUrl:
          typeof value.sourceUrl === 'string' ? value.sourceUrl.trim() : null,
        fileName:
          typeof value.fileName === 'string' ? value.fileName.trim() : null,
      } satisfies DocGenerationMaterialInput
    })
    .filter((value): value is DocGenerationMaterialInput => value !== null)

  if (!openapiSourceId) {
    return badRequest('openapiSourceId is required')
  }

  if (documentTypeInput && !isOpenApiDocumentType(documentTypeInput)) {
    return badRequest('Invalid documentType')
  }

  const documentType = isOpenApiDocumentType(documentTypeInput)
    ? documentTypeInput
    : null

  if (rawMaterials.length > 0 && materials.length !== rawMaterials.length) {
    return badRequest('One or more supplemental materials are invalid')
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

  const uniqueEndpointIds = Array.from(
    new Set(
      endpointIds.filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  )

  const endpoints =
    uniqueEndpointIds.length > 0
      ? await db
          .select()
          .from(apiEndpoints)
          .where(
            and(
              eq(apiEndpoints.sourceId, openapiSourceId),
              inArray(apiEndpoints.id, uniqueEndpointIds),
            ),
          )
          .limit(MAX_ENDPOINTS_PER_REQUEST)
      : []

  if (uniqueEndpointIds.length > 0 && endpoints.length !== uniqueEndpointIds.length) {
    return badRequest('One or more selected endpoints could not be loaded')
  }

  try {
    const template = templateId
      ? await getTemplate(templateId, result.ctx.workspaceId)
      : null
    if (templateId && !template) {
      return badRequest('Template not found')
    }

    const hasSelectedEndpoints = endpoints.length > 0
    const hasPrompt = prompt.length > 0
    const hasRagContext = ragEnabled
    const shouldUseAi = hasSelectedEndpoints || hasPrompt || hasRagContext
    const shouldCreateFromTemplate =
      Boolean(template) && !hasSelectedEndpoints && !hasPrompt && !hasRagContext

    const resolvedDocumentType =
      documentType ?? (hasSelectedEndpoints ? 'api-reference' : null)
    const docTypeMeta = getOpenApiDocumentTypeMeta(resolvedDocumentType)
    const sourceDisplayName = source.name

    if (!shouldUseAi && !shouldCreateFromTemplate) {
      const title = buildOpenApiDocumentTitle({
        sourceName: sourceDisplayName,
        endpoints: [],
        documentType: resolvedDocumentType,
        prompt,
      })
      const doc = await createDocument(
        result.ctx.workspaceId,
        title,
        '',
        result.ctx.userId,
        '',
        docTypeMeta?.category ?? '',
        [
          'openapi',
          ...(resolvedDocumentType ? [resolvedDocumentType] : []),
        ],
      )

      recordDomainEvent('ai_doc_generate', 'empty')
      return NextResponse.json({
        document: {
          documentId: doc.id,
          title,
          mode: 'empty',
        },
      })
    }

    if (shouldCreateFromTemplate && template) {
      const title = buildOpenApiDocumentTitle({
        sourceName: sourceDisplayName,
        endpoints: [],
        documentType: resolvedDocumentType,
        prompt,
        templateName: template.name,
      })
      const doc = await createDocument(
        result.ctx.workspaceId,
        title,
        template.content,
        result.ctx.userId,
        template.description,
        docTypeMeta?.category ?? getTemplateCategoryLabel(template.category),
        [
          'openapi',
          'template',
          ...(resolvedDocumentType ? [resolvedDocumentType] : []),
          ...(template.category ? [template.category] : []),
        ],
      )
      await incrementTemplateUsage(template.id, result.ctx.workspaceId)

      recordDomainEvent('ai_doc_generate', 'template')
      return NextResponse.json({
        document: {
          documentId: doc.id,
          title,
          mode: 'template',
        },
      })
    }

    let parsedSpec: Awaited<ReturnType<typeof parseOpenAPISpec>> | null = null
    try {
      parsedSpec = await parseOpenAPISpec(source.rawContent)
    } catch (error) {
      logServerError(
        'Failed to parse OpenAPI source while building AI documentation context.',
        error,
        {
          workspaceId: result.ctx.workspaceId,
          openapiSourceId,
        },
      )
    }

    const parsedEndpointLookup = buildParsedEndpointLookup(
      parsedSpec?.endpoints ?? [],
    )

    const parsedEndpoints = endpoints.map((ep) => ({
      ...(parsedEndpointLookup.get(
        buildEndpointLookupKey(ep.method ?? 'GET', ep.path ?? '/', ep.operationId),
      ) ??
      parsedEndpointLookup.get(`${(ep.method ?? 'GET').toUpperCase()} ${ep.path ?? '/'}`) ?? {
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
        security: null,
      }),
      id: ep.id,
    }))

    const retrievedContext =
      hasRagContext
        ? await retrieveDocGenerationContext({
            workspaceId: result.ctx.workspaceId,
            sourceName: sourceDisplayName,
            endpoints: parsedEndpoints,
            apiTitle: parsedSpec?.title ?? source.name,
            userPrompt: prompt,
            documentType: resolvedDocumentType,
            requestedModelId: model,
            materials,
            multiTurn: multiTurnRag,
            visibility: {
              userId: result.ctx.userId,
              role: result.ctx.role,
            },
            ragMode,
          })
        : null

    const generated = await generateOpenApiDocument({
      workspaceId: result.ctx.workspaceId,
      sourceName: sourceDisplayName,
      endpoints: parsedEndpoints,
      apiTitle: parsedSpec?.title ?? source.name,
      apiVersion: parsedSpec?.version ?? source.parsedVersion,
      servers: parsedSpec?.servers ?? [],
      securitySchemes: parsedSpec?.securitySchemes ?? {},
      prompt,
      documentType: resolvedDocumentType,
      template: template
        ? {
            name: template.name,
            description: template.description,
            category: template.category,
            content: template.content,
          }
        : null,
      retrievedContext,
      model,
    })
    const retrievalDiagnostics = retrievedContext
      ? {
          materialCount: retrievedContext.materialCount,
          materialTitles: retrievedContext.materialTitles,
          queryVariants: retrievedContext.queryVariants,
          ragMode: retrievedContext.ragMode,
          workspaceSourceCount: retrievedContext.workspaceSourceCount,
        }
      : null

    const endpointTags = Array.from(
      new Set(
        endpoints.flatMap((endpoint) => [
          endpoint.method.toLowerCase(),
          ...(((endpoint.tags as string[] | null) ?? [])),
        ]),
      ),
    )
    const summary =
      prompt ||
      (endpoints.length === 1
        ? endpoints[0].summary ?? endpoints[0].description ?? ''
        : endpoints.length > 1
          ? `Combined documentation for ${endpoints.length} selected endpoints.`
          : hasRagContext
            ? 'Documentation generated with retrieval context.'
          : template?.description ?? '')
    const doc = await createDocument(
      result.ctx.workspaceId,
      generated.title,
      generated.content,
      result.ctx.userId,
      summary,
      docTypeMeta?.category ??
        getTemplateCategoryLabel(template?.category) ??
        '',
      [
        'openapi',
        'ai-generated',
        ...(resolvedDocumentType ? [resolvedDocumentType] : []),
        ...(template?.category ? [template.category] : []),
        ...endpointTags,
        ],
      )

      if (template) {
        await incrementTemplateUsage(template.id, result.ctx.workspaceId)
      }

      recordDomainEvent('ai_doc_generate')
      return NextResponse.json({
        document: {
          documentId: doc.id,
        title: generated.title,
        mode: 'ai',
        retrieval: retrievalDiagnostics,
      },
    })
  } catch (error) {
    logServerError('AI doc generation failed', error, {
      workspaceId: result.ctx.workspaceId,
      openapiSourceId,
    })

    const message =
      error instanceof Error ? error.message : 'Generation failed'
    const status =
      error instanceof AiCompletionError
        ? error.status
        : error instanceof DocGenerationMaterialError
          ? error.status
          : 502

      return NextResponse.json({ error: message }, { status })
  }
}

export const POST = withRouteObservability(generateDocsRoute, {
  route: '/api/ai/generate-docs',
})
