import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { apiEndpoints, openapiSources } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { generateAllTypes } from '@/lib/openapi/type-exporter'
import { extractJsonSchemas, generateJsonSchemaBundle } from '@/lib/openapi/schema-exporter'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const result = await withWorkspaceAuth('viewer')
  if ('error' in result) return result.error

  const { id } = await context.params
  const { searchParams } = request.nextUrl
  const format = searchParams.get('format') ?? 'typescript'

  if (format !== 'typescript' && format !== 'jsonschema') {
    return badRequest('format must be "typescript" or "jsonschema"')
  }

  // Verify source belongs to workspace
  const source = await db.query.openapiSources.findFirst({
    where: eq(openapiSources.id, id),
  })

  if (!source || source.workspaceId !== result.ctx.workspaceId) {
    return notFound()
  }

  const endpoints = await db
    .select()
    .from(apiEndpoints)
    .where(eq(apiEndpoints.sourceId, id))

  if (format === 'typescript') {
    const tsResult = generateAllTypes(
      endpoints.map((ep) => ({
        operationId: ep.operationId,
        path: ep.path,
        method: ep.method,
        tags: ep.tags,
        parameters: ep.parameters ?? [],
        requestBody: ep.requestBody ?? null,
        responses: ep.responses ?? {},
      })),
    )

    return new NextResponse(tsResult.content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${tsResult.filename}"`,
      },
    })
  }

  // JSON Schema
  const schemas = extractJsonSchemas(
    endpoints.map((ep) => ({
      path: ep.path,
      method: ep.method,
      requestBody: ep.requestBody,
      responses: ep.responses,
    })),
  )
  const bundle = generateJsonSchemaBundle(schemas)

  return new NextResponse(bundle, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="api-schemas.json"',
    },
  })
}
