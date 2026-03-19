import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { openapiSources } from '@/lib/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { generateSdk, packageSdk, type SdkLanguage } from '@/lib/sdk-generator'
import type { OpenApiDocument } from '@/lib/sdk-generator/shared'
import YAML from 'yaml'

const VALID_LANGUAGES: SdkLanguage[] = ['typescript', 'python', 'go']

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { openapiSourceId, language, packageName, version = '1.0.0' } = body

  if (!openapiSourceId || !language || !packageName) {
    return badRequest('openapiSourceId, language, and packageName are required')
  }

  if (!VALID_LANGUAGES.includes(language)) {
    return badRequest(`language must be one of: ${VALID_LANGUAGES.join(', ')}`)
  }

  const source = await db.query.openapiSources.findFirst({
    where: and(
      eq(openapiSources.id, openapiSourceId),
      isNull(openapiSources.deletedAt),
    ),
  })

  if (!source || source.workspaceId !== result.ctx.workspaceId) {
    return notFound()
  }

  const generatorSpec = rebuildSpec(source.rawContent)
  const files = generateSdk(generatorSpec, language, packageName, version)
  const zipBuffer = await packageSdk(files)

  const safeName = packageName.replace(/[^a-zA-Z0-9._-]/g, '')
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '')

  return new NextResponse(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}-${language}-v${safeVersion}.zip"`,
    },
  })
}

function rebuildSpec(rawContent: string): OpenApiDocument {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(rawContent)
    } catch {
      return YAML.parse(rawContent)
    }
  })()

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid OpenAPI document')
  }

  return parsed as OpenApiDocument
}
