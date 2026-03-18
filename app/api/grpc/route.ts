import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { parseProtoContent, parseProtoZip, computeChecksum } from '@/lib/grpc/proto-parser'
import { createGrpcSource, listGrpcSources } from '@/lib/queries/grpc'

const MAX_PROTO_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * POST /api/grpc — Create a new gRPC source.
 */
export async function POST(req: NextRequest) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const contentType = req.headers.get('content-type') ?? ''

  let name: string
  let rawContent: string
  let sourceType: 'proto_file' | 'proto_zip' | 'nacos' | 'etcd'
  let sourceConfig: Record<string, unknown> | undefined
  let spec

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    name = (formData.get('name') as string)?.trim()
    if (!name) return badRequest('name is required')

    const file = formData.get('file') as File | null
    if (!file) return badRequest('file is required')
    if (file.size > MAX_PROTO_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 5 MB)' },
        { status: 413 },
      )
    }

    const isZip =
      file.name.endsWith('.zip') ||
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed'

    if (isZip) {
      sourceType = 'proto_zip'
      const buffer = new Uint8Array(await file.arrayBuffer())
      rawContent = Buffer.from(buffer).toString('base64')
      spec = await parseProtoZip(buffer)
    } else {
      sourceType = 'proto_file'
      rawContent = await file.text()
      spec = await parseProtoContent(rawContent)
    }
  } else {
    const body = await req.json().catch(() => null)
    if (!body) return badRequest('Invalid request payload')

    name = body.name?.trim()
    if (!name) return badRequest('name is required')

    if (body.sourceType === 'nacos' || body.sourceType === 'etcd') {
      sourceType = body.sourceType
      sourceConfig = body.sourceConfig ?? {}
      // For registry sources, we store an empty placeholder until sync
      rawContent = ''
      spec = undefined
    } else if (body.rawContent) {
      sourceType = 'proto_file'
      rawContent = body.rawContent
      if (rawContent.length > MAX_PROTO_SIZE) {
        return NextResponse.json(
          { error: 'Content too large (max 5 MB)' },
          { status: 413 },
        )
      }
      try {
        spec = await parseProtoContent(rawContent)
      } catch (err) {
        return badRequest(
          `Invalid proto file: ${err instanceof Error ? err.message : 'Parse error'}`,
        )
      }
    } else {
      return badRequest('Either a file upload or rawContent/sourceConfig is required')
    }
  }

  const checksum = computeChecksum(rawContent)

  const source = await createGrpcSource(
    {
      workspaceId: ctx.workspaceId,
      name,
      sourceType,
      sourceConfig: sourceConfig ?? null,
      rawContent,
      checksum,
    },
    spec,
  )

  return NextResponse.json(
    {
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      serviceCount: spec?.services.length ?? 0,
      createdAt: source.createdAt,
    },
    { status: 201 },
  )
}

/**
 * GET /api/grpc — List all gRPC sources for the workspace.
 */
export async function GET() {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const sources = await listGrpcSources(ctx.workspaceId)
  return NextResponse.json(sources)
}
