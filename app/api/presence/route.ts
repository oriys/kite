import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  upsertPresence,
  removePresence,
  getActiveEditors,
  clearPresenceForDocument,
} from '@/lib/queries/active-editors'
import { getDocument } from '@/lib/queries/documents'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const documentId = request.nextUrl.searchParams.get('documentId')
  if (!documentId) return badRequest('documentId is required')

  const document = await getDocument(documentId, result.ctx.workspaceId)
  if (!document) {
    await clearPresenceForDocument(documentId)
    return NextResponse.json([])
  }

  const editors = await getActiveEditors(documentId)
  return NextResponse.json(editors)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { documentId, cursorPosition } = body
  if (!documentId) return badRequest('documentId is required')

  const document = await getDocument(documentId, result.ctx.workspaceId)
  if (!document) {
    await clearPresenceForDocument(documentId)
    return NextResponse.json({ success: true, stale: true })
  }

  const editor = await upsertPresence(
    documentId,
    result.ctx.userId,
    cursorPosition,
  )

  return NextResponse.json(editor)
}

export async function DELETE(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const documentId = request.nextUrl.searchParams.get('documentId')
  if (!documentId) return badRequest('documentId is required')

  const document = await getDocument(documentId, result.ctx.workspaceId)
  if (!document) {
    await clearPresenceForDocument(documentId)
  } else {
    await removePresence(documentId, result.ctx.userId)
  }

  return NextResponse.json({ success: true })
}
