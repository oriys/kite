import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'

import { generateOpenApiDocument } from '@/lib/ai-doc-generator'
import { AiCompletionError } from '@/lib/ai-server'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
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
import { apiEndpoints, openapiSources } from '@/lib/schema'
import { logServerError } from '@/lib/server-errors'

const MAX_ENDPOINTS_PER_REQUEST = 50

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

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

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

  if (!openapiSourceId) {
    return badRequest('openapiSourceId is required')
  }

  if (documentTypeInput && !isOpenApiDocumentType(documentTypeInput)) {
    return badRequest('Invalid documentType')
  }

  const documentType = isOpenApiDocumentType(documentTypeInput)
    ? documentTypeInput
    : null

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
    const shouldUseAi = hasSelectedEndpoints || hasPrompt
    const shouldCreateFromTemplate =
      Boolean(template) && !hasSelectedEndpoints && !hasPrompt

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
      model,
    })

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

    return NextResponse.json({
      document: {
        documentId: doc.id,
        title: generated.title,
        mode: 'ai',
      },
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
