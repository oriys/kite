import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  badRequest,
  forbidden,
  notFound,
  withWorkspaceAuth,
} from '@/lib/api-utils'
import { isValidDocumentPermissionLevel } from '@/lib/constants'
import { getDocument } from '@/lib/queries/documents'
import {
  buildDocumentAccessMap,
  clearDocumentPermission,
  listDocumentPermissions,
  setDocumentPermission,
} from '@/lib/queries/document-permissions'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const document = await getDocument(id, result.ctx.workspaceId)
  if (!document) return notFound()

  const access = (
    await buildDocumentAccessMap([document], result.ctx.userId, result.ctx.role)
  ).get(document.id)
  if (!access?.canManagePermissions) return forbidden()

  const permissions = await listDocumentPermissions(id, result.ctx.workspaceId)
  return NextResponse.json(permissions)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const document = await getDocument(id, result.ctx.workspaceId)
  if (!document) return notFound()

  const access = (
    await buildDocumentAccessMap([document], result.ctx.userId, result.ctx.role)
  ).get(document.id)
  if (!access?.canManagePermissions) return forbidden()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return badRequest('userId is required')

  try {
    if (body.level === null) {
      await clearDocumentPermission({
        documentId: id,
        workspaceId: result.ctx.workspaceId,
        userId,
        actorId: result.ctx.userId,
      })
    } else {
      if (
        typeof body.level !== 'string'
        || !isValidDocumentPermissionLevel(body.level)
      ) {
        return badRequest('Invalid permission level')
      }

      await setDocumentPermission({
        documentId: id,
        workspaceId: result.ctx.workspaceId,
        userId,
        level: body.level,
        actorId: result.ctx.userId,
      })
    }
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : 'Failed to update permission',
    )
  }

  return NextResponse.json({ ok: true })
}
