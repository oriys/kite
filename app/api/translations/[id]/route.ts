import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import {
  updateTranslationStatus,
  deleteTranslationLink,
} from '@/lib/queries/translations'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body?.status) return badRequest('status is required')

  const link = await updateTranslationStatus(id, body.status)
  if (!link) return notFound()

  return NextResponse.json(link)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  await deleteTranslationLink(id)
  return NextResponse.json({ success: true })
}
